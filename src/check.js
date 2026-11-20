// Setup check page: one fixed cloud request (shows App Check + AI Logic errors verbatim) and a Prompt API probe.
import { initHybrid, run } from "./hybrid.js";

const $ = (id) => document.getElementById(id);
const models = initHybrid();
const show = (id, text) => { const el = $(id); el.hidden = false; el.textContent = text; };
const chrome = (navigator.userAgent.match(/Chrome\/(\d+)/) || [])[1];

$("cloud").onclick = async () => {
  if (models.mock) return show("cloudOut", "No Firebase config in this build (demo mode).");
  $("cloud").disabled = true; show("cloudOut", "Sending one fixed sentence…");
  try {
    const timeout = new Promise((_, no) => setTimeout(() => no(new Error("no answer in 30 s (network, App Check or quota)")), 30000));
    const r = await Promise.race([run("cloud", ["Reply with the single word: ok"], null, { step: "setup check" }), timeout]);
    show("cloudOut", `OK — the cloud model answered in ${r.ms} ms (source: ${r.source}).\nAnswer: ${r.text.trim().slice(0, 80)}`);
  } catch (e) {
    show("cloudOut", `FAILED — ${e?.message || e}\n${/app.?check/i.test(String(e?.message)) ? "App Check did not pass: check the reCAPTCHA key's domain and the App Check registration." : ""}`);
  }
  $("cloud").disabled = false;
};

$("device").onclick = async () => {
  const lines = [`Browser: ${chrome ? "Chrome " + chrome : navigator.userAgent}`];
  const LM = globalThis.LanguageModel;
  if (!LM) lines.push("Prompt API: not present in this browser (needs desktop Google Chrome 148+).");
  else if (!/Google Chrome/.test(navigator.userAgentData?.brands?.map((b) => b.brand).join(" ") ?? "Google Chrome")) lines.push("Note: this looks like plain Chromium — its Prompt API is a stub; use Google Chrome.");
  else {
    try { lines.push(`Gemini Nano availability: ${await LM.availability()}`); }
    catch (e) { lines.push(`Gemini Nano availability check failed: ${e?.message || e}`); }
    lines.push("available = ready · downloadable/downloading = press 'Turn on on-device AI' on the main page and wait · unavailable = this PC can't run it.");
  }
  show("deviceOut", lines.join("\n"));
};
