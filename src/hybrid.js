// Hybrid inference core: one model handle per mode, every call returns {text, source, ms}.
// source = "on_device" | "in_cloud" | "mock" — shown to the user on every answer.
import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } from "firebase/ai";
import { loadConfig } from "./config.js";
import { SPAN_SCHEMA } from "./redact.js";

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
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  if (siteKey) initializeAppCheck(app, { provider: new ReCaptchaV3Provider(siteKey), isTokenAutoRefreshEnabled: true });
  const ai = getAI(app, { backend: new GoogleAIBackend() });
  models = {
    mock: false,
    // private step: must not leave the device — throws if Nano is unavailable
    // Chrome Prompt API responseConstraint = JSON schema, so Nano answers with parseable spans.
    device: getGenerativeModel(ai, { mode: InferenceMode.ONLY_ON_DEVICE,
      onDeviceParams: { promptOptions: { responseConstraint: SPAN_SCHEMA } } }),
    // safe-text step (checking the cloud answer, which holds placeholders only): device first, cloud fallback
    prefer: getGenerativeModel(ai, { mode: InferenceMode.PREFER_ON_DEVICE }),
    // heavy step: cloud (receives only what the ledger allows)
    cloud: getGenerativeModel(ai, { mode: InferenceMode.ONLY_IN_CLOUD }),
  };
  return models;
}

// Must be called from a user gesture (Chrome user-activation rule).
export async function warmDevice(onProgress) {
  if (!models || models.mock) return false;
  await models.device.initializeDeviceModel((p) => onProgress?.(p));
  return true;
}

function sourceOf(resp, which) {
  // SDK reports where inference ran; fall back to the mode we forced if the field is missing.
  const s = resp?.inferenceSource ?? resp?.response?.inferenceSource;
  if (s) return String(s).toLowerCase().includes("device") ? "on_device" : "in_cloud";
  return which === "cloud" ? "in_cloud" : "unknown"; // device: never assume — deviceSpans fails closed on "unknown"
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
  const resp = await models[which].generateContent(parts);
  const r = resp.response ?? resp;
  const out = { which, text: r.text(), source: sourceOf(resp, which), ms: Math.round(performance.now() - t0), ...meta };
  ledger?.add(out, parts);
  return out;
}
