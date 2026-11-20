// On-device boundary: find personal data, swap it for reversible placeholders, keep the map on the device.
// Two passes: (1) deterministic patterns (e-mail, phone, card-like numbers, dates of birth),
// (2) Gemini Nano (ONLY_ON_DEVICE, structured JSON) for names, addresses, health details.
// The map never goes into the ledger or the cloud prompt.

export const CLASSES = ["NAME", "EMAIL", "PHONE", "ID", "ADDRESS", "DOB", "HEALTH", "ORG"];

// Order matters: earlier classes win when matches overlap (a date must not also count as a phone number).
const PATTERNS = [
  ["EMAIL", /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g],
  ["DOB", /\b(?:19|20)\d{2}[-/.](?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\d|3[01])\b/g],
  ["ID", /\b\d{6}-\d{7}\b|\b\d{3}-\d{2}-\d{4}\b|\b(?:\d{4}[ -]?){3}\d{1,4}\b/g],
  ["PHONE", /\+?\d[\d\s().-]{7,}\d/g],
];

export function patternSpans(text) {
  const taken = [];
  const spans = [];
  for (const [cls, re] of PATTERNS) {
    for (const m of text.matchAll(re)) {
      const a = m.index, b = m.index + m[0].length;
      if (taken.some(([x, y]) => a < y && x < b)) continue;
      taken.push([a, b]);
      spans.push({ cls, value: m[0] });
    }
  }
  return spans;
}

// Spans from the device model: [{cls, value}] — value must appear verbatim in the text.
export function applySpans(text, spans, map = new Map()) {
  const counters = {};
  for (const [ph] of map) { const c = ph.slice(1, ph.lastIndexOf("_")); counters[c] = (counters[c] ?? 0) + 1; }
  const uniq = [...new Map(spans.filter((s) => s.value && text.includes(s.value)).map((s) => [s.value, s])).values()]
    .sort((a, b) => b.value.length - a.value.length); // longest first so "Kim Minji" beats "Kim"
  let out = text;
  for (const s of uniq) {
    let ph = [...map].find(([, v]) => v === s.value)?.[0];
    if (!ph) { counters[s.cls] = (counters[s.cls] ?? 0) + 1; ph = `[${s.cls}_${counters[s.cls]}]`; map.set(ph, s.value); }
    out = out.split(s.value).join(ph);
  }
  return { text: out, map, classes: [...new Set(uniq.map((s) => s.cls))] };
}

export function rehydrate(text, map) {
  let out = text;
  for (const [ph, v] of map) out = out.split(ph).join(v);
  return out;
}

// Anything that still looks like personal data after redaction blocks the cloud call.
export function leakCheck(redacted) { return patternSpans(redacted); }

export const SPAN_SCHEMA = {
  type: "object", required: ["spans"],
  properties: { spans: { type: "array", items: { type: "object", required: ["cls", "value"],
    properties: { cls: { type: "string", enum: CLASSES }, value: { type: "string" }, role: { type: "string", maxLength: 40 } } } } },
};

export const DEVICE_SCHEMA_PROMPT = (text) =>
  `List every piece of personal data in the text below. Return JSON only: ` +
  `{"spans":[{"cls":one of ${JSON.stringify(CLASSES)},"value":exact substring,"role":short generic hint with no identifying words, e.g. "the client, she" or "a medication"}]}.\n---\n${text}`;

// Role hints help the cloud write naturally ("[NAME_1] = the client, she"). A hint is dropped if it could identify:
// it repeats any word of any kept-back value, or the rules see personal data in it.
export function safeRole(role, values) {
  const r = String(role ?? "").trim().slice(0, 40);
  if (!r) return "";
  const words = new Set(values.flatMap((v) => v.toLowerCase().split(/[^\p{L}\p{N}]+/u)).filter((w) => w.length > 1));
  if (r.toLowerCase().split(/[^\p{L}\p{N}]+/u).some((w) => words.has(w))) return "";
  if (patternSpans(r).length || /\d/.test(r)) return "";
  return r;
}
