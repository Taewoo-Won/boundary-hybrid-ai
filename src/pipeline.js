// The boundary pipeline, independent of the DOM so it can be tested in node.
// 1. prepare  — on device: patterns + Gemini Nano find personal data, swap it for placeholders (fail closed).
// 2. outgoing — the exact text that would leave the device; blocked if anything still looks personal.
// 3. askCloud — cloud model sees only the outgoing text; the answer is rehydrated locally.
import { patternSpans, applySpans, rehydrate, leakCheck, safeRole, DEVICE_SCHEMA_PROMPT } from "./redact.js";
import { parseSpans } from "./spans.js";

export const TASKS = {
  reply: { label: "Draft a reply email", prompt: "Write a short, warm, professional reply email based on this case note. Keep every placeholder like [NAME_1] exactly as written; the Placeholders list says who or what each one is." },
  handover: { label: "Summarize for a colleague's handover", prompt: "Summarize this case note as a handover for a colleague: 3 bullet points of facts, then 2 next steps. Keep every placeholder like [NAME_1] exactly as written; the Placeholders list says who or what each one is." },
  spanish: { label: "Translate to Spanish", prompt: "Translate this note into Spanish. Keep every placeholder like [NAME_1] exactly as written; the Placeholders list says who or what each one is." },
};

export async function prepare(text, deviceSpansFn, ledger) {
  const pat = patternSpans(text);
  let dev;
  try { dev = await deviceSpansFn(text, ledger); }
  catch (e) { return { ok: false, reason: `On-device check failed (${e.message}). Nothing was sent.` }; }
  const spans = [...pat.map((s) => ({ ...s, by: "pattern" })), ...dev.spans.map((s) => ({ ...s, by: dev.by ?? "device" }))];
  return { ok: true, spans, deviceMs: dev.ms, demo: !!dev.demo };
}

// spans the user kept (they can untick or add) → redacted text + local map
export function outgoing(text, spans, taskKey) {
  const r = applySpans(text, spans);
  const values = [...r.map.values()];
  const legend = [...r.map].map(([ph, v]) => [ph, safeRole(spans.find((s) => s.value === v && s.role)?.role, values)])
    .filter(([, role]) => role).sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true })).map(([ph, role]) => `${ph} = ${role}`).join("\n");
  const body = legend ? `Placeholders:\n${legend}\n---\n${r.text}` : r.text;
  const leaks = leakCheck(body);
  const prompt = `${TASKS[taskKey].prompt}\n---\n${body}`;
  return { redacted: body, map: r.map, classes: r.classes, leaks, prompt, legend, blocked: leaks.length > 0 };
}

const PH = /^\[[A-Z]+_\d+\]$/;
// 11/22: a re-check span that contains a placeholder ("Best number [PHONE_1]", "email [EMAIL_1]") is not new personal data —
// the placeholder is already kept back and the words around it are context. Counting it locked Send in a loop on a real run.
const HAS_PH = /\[[A-Z]+_\d+\]/;
const realSpans = (spans) => spans.filter((s) => { const v = s.value.trim(); return !PH.test(v) && !/^\[?[A-Z]+_\d+\]?$/.test(v) && !HAS_PH.test(v); });

// Second on-device pass over the text that is about to leave: anything Nano still calls personal locks Send.
export async function residualCheck(out, deviceSpansFn, ledger) {
  try {
    const r = await deviceSpansFn(out.redacted, ledger, "re-check outgoing text");
    return { ok: true, spans: realSpans(r.spans), demo: !!r.demo };
  } catch (e) { return { ok: false, reason: `On-device re-check failed (${e.message}). Nothing was sent.` }; }
}

// The cloud answer holds placeholders only, so checking it may run on device or fall back to cloud (PREFER_ON_DEVICE).
// Flags personal-looking data the cloud model invented (rules + model).
export async function checkAnswer(raw, runFn, ledger) {
  const rules = patternSpans(raw).map((s) => ({ ...s, by: "rule" }));
  let model = [], source = "skipped";
  try {
    const r = await runFn("prefer", [DEVICE_SCHEMA_PROMPT(raw)], ledger, { step: "check cloud answer" });
    source = r.source; model = realSpans(parseSpans(r.text, raw) ?? []);
  } catch { /* the rules result still stands */ }
  const seen = new Set(); const flagged = [];
  for (const s of [...rules, ...model]) if (!seen.has(s.value)) { seen.add(s.value); flagged.push(s); }
  return { flagged, source };
}

export async function askCloud(out, runFn, ledger) {
  if (out.blocked) throw new Error("blocked: personal data still visible");
  const r = await runFn("cloud", [out.prompt], ledger, { step: "cloud task", classesOut: out.classes });
  const missing = [...out.map.keys()].filter((ph) => out.redacted.includes(ph) && !r.text.includes(ph));
  return { raw: r.text, final: rehydrate(r.text, out.map), source: r.source, ms: r.ms, missing };
}
