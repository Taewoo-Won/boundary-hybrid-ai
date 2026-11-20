import { CLASSES } from "./redact.js";

export function parseSpans(raw, text) {
  const m = String(raw).match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]);
    if (!Array.isArray(j.spans)) return null;
    return j.spans.filter((s) => CLASSES.includes(s.cls) && typeof s.value === "string" && s.value && text.includes(s.value));
  } catch { return null; }
}
