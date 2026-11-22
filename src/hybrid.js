// Hybrid inference core: one model handle per mode, every call returns {text, source, ms}.
// source = "on_device" | "in_cloud" | "mock" — shown to the user on every answer.
import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider, ReCaptchaV3Provider } from "firebase/app-check";
import appCheckPublic from "./appcheck.public.json" with { type: "json" };
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } from "firebase/ai";
import { loadConfig } from "./config.js";
import { shimLanguageModel } from "./promptShim.js";

let models = null;

export function initHybrid() {
  const cfg = loadConfig();
  if (cfg.mock) { models = { mock: true }; return models; }
  const app = initializeApp(cfg.firebase);
  // App Check: the rules accept debug tokens. Dev builds mint one; a judged build can pin a registered
  // debug token via VITE_APPCHECK_DEBUG_TOKEN (set as a build secret, never committed).
  const dbg = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN;
  if (dbg) self.FIREBASE_APPCHECK_DEBUG_TOKEN = dbg;
  else if (import.meta.env.DEV) self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  // Firebase enforces App Check for AI Logic in every project (since 2026-11-02): no token, no cloud call.
  // The deployed page uses a score-based reCAPTCHA Enterprise key (public, committed in appcheck.public.json);
  // a reCAPTCHA v3 key from the build env still works for forks.
  const provider = pickAppCheckProvider();
  if (provider) initializeAppCheck(app, { provider, isTokenAutoRefreshEnabled: true });
  shimLanguageModel(); // must run before the SDK captures LanguageModel — see promptShim.js
  const ai = getAI(app, { backend: new GoogleAIBackend() });
  models = {
    mock: false,
    // private step: must not leave the device — throws if Nano is unavailable
    device: getGenerativeModel(ai, { mode: InferenceMode.ONLY_ON_DEVICE,
      // 11/22: no responseConstraint. On a real PC (Chrome 157) prompts under a JSON-schema constraint hung for
      // minutes in most runs and wedged the on-device model until Chrome restarted, while the same prompt without a
      // constraint always returned. The prompt asks for JSON; parseSpans keeps only spans found verbatim in the note,
      // and anything unparseable fails closed.
      onDeviceParams: { createOptions: textOnly() } }),
    // safe-text step (checking the cloud answer, which holds placeholders only): device first, cloud fallback
    prefer: getGenerativeModel(ai, { mode: InferenceMode.PREFER_ON_DEVICE, onDeviceParams: { createOptions: textOnly() } }),
    // heavy step: cloud (receives only what the ledger allows)
    cloud: getGenerativeModel(ai, { mode: InferenceMode.ONLY_IN_CLOUD }),
  };
  return models;
}

export function pickAppCheckProvider(env = import.meta.env, pub = appCheckPublic) {
  const ent = env?.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY || pub?.recaptchaEnterpriseSiteKey;
  if (ent) return new ReCaptchaEnterpriseProvider(ent);
  const v3 = env?.VITE_RECAPTCHA_SITE_KEY;
  return v3 ? new ReCaptchaV3Provider(v3) : null;
}

// 11/22: the SDK's default create options ask for text AND image input. Boundary only sends text, and on a real PC
// the image-capable session stalled for minutes while a text-only session answered in seconds — so ask for text only.
export function textOnly() {
  return { expectedInputs: [{ type: "text", languages: ["en"] }], expectedOutputs: [{ type: "text", languages: ["en"] }] };
}

// Must be called from a user gesture (Chrome user-activation rule).
export async function warmDevice(onProgress) {
  if (!models || models.mock) return false;
  await models.device.initializeDeviceModel((p) => onProgress?.(p));
  const LM = globalThis.LanguageModel;
  if (LM && (await LM.availability()) === "available") {
    // Opens the page's one shared on-device session (promptShim.js), so the first real check starts warm.
    await LM.create(textOnly());
  }
  return true;
}

function sourceOf(resp, which) {
  // SDK reports where inference ran; fall back to the mode we forced if the field is missing.
  const s = resp?.inferenceSource ?? resp?.response?.inferenceSource;
  if (s) return String(s).toLowerCase().includes("device") ? "on_device" : "in_cloud";
  return which === "cloud" ? "in_cloud" : "unknown"; // device: never assume — deviceSpans fails closed on "unknown"
}

// 11/22: the SDK keeps each on-device session alive until the next call; with several models that piled up and
// Chrome's on-device model stopped answering after 4–5 calls on a real PC. Close it as soon as the answer is in.
export function freeDeviceSession(model) {
  const ad = model?.chromeAdapter;
  if (!ad?.oldSession) return false;
  try { ad.oldSession.destroy?.(); } catch { /* already gone */ }
  ad.oldSession = undefined;
  return true;
}

export async function run(which, parts, ledger, meta = {}) {
  const t0 = performance.now();
  if (!models || models.mock) {
    const body = String(parts[0]).split("\n---\n").pop();
    const text = which === "cloud" ? `[Demo — no model connected. A real run returns the task result; here the outgoing text is echoed.]\n${body}` : which === "prefer" ? '{"spans":[]}' : `[mock ${which}]`;
    const rec = { which, source: "mock", ms: 0, ...meta };
    ledger?.add(rec, parts);
    return { text, ...rec };
  }
  let resp;
  try { resp = await models[which].generateContent(parts); }
  finally { if (which !== "cloud") freeDeviceSession(models[which]); }
  const r = resp.response ?? resp;
  const out = { which, text: r.text(), source: sourceOf(resp, which), ms: Math.round(performance.now() - t0), ...meta };
  ledger?.add(out, parts);
  return out;
}
