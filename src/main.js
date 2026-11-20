import { initHybrid, warmDevice, run } from "./hybrid.js";
import { deviceSpans } from "./deviceSpans.js";
import { CLASSES } from "./redact.js";
import { Ledger } from "./ledger.js";
import { mountLedger } from "./ledgerView.js";
import { mountRecorder } from "./recorder.js";
import { TASKS, prepare, outgoing, askCloud, residualCheck, checkAnswer } from "./pipeline.js";
import { SAMPLES } from "./samples.js";

const $ = (id) => document.getElementById(id);
const ledger = new Ledger();
const models = initHybrid();
mountLedger($("ledger"), ledger);
mountRecorder($("rec"), $("recStatus"));

$("mode").textContent = models.mock ? "Demo mode — no model connected" : "Firebase AI Logic · hybrid";
$("mode").classList.toggle("demo", !!models.mock);
for (const [k, t] of Object.entries(TASKS)) $("task").append(new Option(t.label, k));
for (const c of CLASSES) $("addCls").append(new Option(c, c));

let sampleIdx = 0, state = null;
$("sample").onclick = () => { $("note").value = SAMPLES[sampleIdx++ % SAMPLES.length].text; };

$("warm").onclick = async () => {
  if (models.mock) { $("warm").textContent = "Demo mode (no model)"; return; }
  $("warm").disabled = true;
  try {
    await warmDevice((p) => ($("warm").textContent = `Downloading model ${Math.round((p?.loaded ?? p) * 100) || 0}%`));
    $("warm").textContent = "On-device AI ready";
  } catch (e) { $("warm").textContent = "On-device AI unavailable"; $("warm").disabled = false; console.warn(e); }
};

// Demo mode only: no model is connected, so step 2 uses the sample's hand labels and says so.
async function demoSpans(text, led, step = "find personal data") {
  await run("device", [text], led, { step: `${step} (demo labels)` });
  const s = SAMPLES.find((x) => x.text === text);
  if (s) return { spans: s.spans, ms: 0, by: "demo", demo: true };
  if (/\[[A-Z]+_\d+\]/.test(text)) return { spans: [], ms: 0, by: "demo", demo: true }; // re-check of a redacted sample
  throw new Error("demo mode can only check the sample notes");
}
const SETUP_HELP = " Boundary needs desktop Google Chrome with Gemini Nano (see chrome://on-device-internals) — plain Chromium only has an echo stub.";

$("prep").onclick = async () => {
  const text = $("note").value.trim();
  $("msg1").textContent = ""; $("s2").hidden = $("s3").hidden = true;
  if (!text) { $("msg1").textContent = "Paste a note first."; return; }
  $("prep").disabled = true; $("msg1").textContent = "Checking on this device…";
  const p = await prepare(text, models.mock ? demoSpans : deviceSpans, ledger);
  $("prep").disabled = false;
  if (!p.ok) { $("msg1").textContent = p.reason + SETUP_HELP; $("msg1").className = "msg bad"; return; }
  $("s2badge").textContent = p.demo ? "Demo · sample labels, no model" : "Gemini Nano · on device";
  $("s2badge").className = p.demo ? "where w-local" : "where w-dev";
  $("msg1").className = "msg"; $("msg1").textContent = p.demo ? "Demo mode: personal data comes from the sample's labels, not a model." : `Checked on device in ${p.deviceMs} ms.`;
  state = { text, spans: p.spans.map((s) => ({ ...s, on: true })) };
  render();
  $("s2").hidden = false;
};

function render() {
  const chips = $("chips"); chips.innerHTML = "";
  const seen = new Set();
  for (const s of state.spans) {
    if (seen.has(s.value)) continue; seen.add(s.value);
    const li = document.createElement("li");
    li.innerHTML = `<label><input type="checkbox"><span class="cls"></span><span class="val"></span><span class="by"></span></label>`;
    const cb = li.querySelector("input"); cb.checked = s.on;
    cb.onchange = () => {
      if (!cb.checked && ["NAME", "HEALTH", "ADDRESS", "ID"].includes(s.cls) &&
          !confirm(`Share "${s.value}" (${s.cls}) with the cloud model?`)) { cb.checked = true; return; } state.spans.filter((x) => x.value === s.value).forEach((x) => (x.on = cb.checked)); render(); };
    li.querySelector(".cls").textContent = s.cls; li.querySelector(".val").textContent = s.value;
    li.querySelector(".by").textContent = { pattern: "rule", user: "you", demo: "label", recheck: "Nano re-check" }[s.by] ?? "Nano";
    li.classList.toggle("off", !s.on);
    chips.append(li);
  }
  state.out = outgoing(state.text, state.spans.filter((s) => s.on), $("task").value);
  $("outgoing").innerHTML = "";
  for (const part of state.out.prompt.split(/(\[[A-Z]+_\d+\])/)) {
    const span = document.createElement("span"); span.textContent = part;
    if (/^\[[A-Z]+_\d+\]$/.test(part)) span.className = "ph";
    $("outgoing").append(span);
  }
  $("send").disabled = state.out.blocked;
  $("msg2").className = state.out.blocked ? "msg bad" : "msg";
  $("msg2").textContent = state.out.blocked
    ? `Blocked: still looks personal — ${state.out.leaks.map((l) => l.value).join(", ")}`
    : `${state.out.prompt.length} characters will leave this device. ${state.out.map.size} details stay here.`;
}
$("task").onchange = () => state && render();
$("add").onclick = () => {
  const v = $("addVal").value.trim();
  if (!v || !state) return;
  if (!state.text.includes(v)) { $("msg2").textContent = "Those exact words are not in the note."; return; }
  state.spans.push({ cls: $("addCls").value, value: v, by: "user", on: true }); $("addVal").value = ""; render();
};
$("send").onclick = async () => {
  $("send").disabled = true; $("msg3").textContent = "";
  $("msg2").className = "msg"; $("msg2").textContent = "Re-checking the outgoing text on this device…";
  const rc = await residualCheck(state.out, models.mock ? demoSpans : deviceSpans, ledger);
  if (!rc.ok) { $("msg2").className = "msg bad"; $("msg2").textContent = rc.reason + SETUP_HELP; $("send").disabled = false; return; }
  const fresh = rc.spans.filter((x) => !state.spans.some((y) => y.value === x.value && y.on));
  if (fresh.length) {
    fresh.forEach((x) => state.spans.push({ ...x, by: "recheck", on: true })); render();
    $("msg2").className = "msg bad";
    $("msg2").textContent = `Re-check found ${fresh.length} more on device: ${fresh.map((x) => x.value).join(", ")} — kept back. Review, then send again.`;
    return;
  }
  $("msg2").textContent = rc.demo ? "Demo mode: re-check skipped (no model)." : "Re-checked on this device: nothing more found.";
  try {
    const r = await askCloud(state.out, run, ledger);
    $("raw").textContent = r.raw;
    $("final").textContent = r.final;
    const chk = await checkAnswer(r.raw, run, ledger);
    const where = chk.source === "on_device" ? "on this device" : chk.source === "in_cloud" ? "in the cloud (device unavailable)" : "in demo mode";
    $("msg3").className = chk.flagged.length || r.missing.length ? "msg bad" : "msg";
    $("msg3").textContent = (models.mock ? "Demo mode: the cloud step echoes the outgoing text. " : `Answered by the cloud model in ${r.ms} ms. `) +
      (r.missing.length ? `It dropped ${r.missing.join(", ")} — check the wording. ` : "") +
      (chk.flagged.length ? `Answer check (${where}) flags text that looks personal but was not in your note: ${chk.flagged.map((x) => x.value).join(", ")}.` : `Answer checked ${where}: no new personal data.`);
    $("s3").hidden = false;
  } catch (e) { $("msg3").textContent = `Not sent: ${e.message}`; $("s3").hidden = false; }
  $("send").disabled = false;
};
$("copy").onclick = async () => {
  await navigator.clipboard?.writeText($("final").textContent).catch(() => {});
  $("copy").textContent = "Copied"; setTimeout(() => ($("copy").textContent = "Copy final text"), 1500);
};
