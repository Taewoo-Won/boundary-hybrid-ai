// Device pass of the boundary: Gemini Nano (ONLY_ON_DEVICE) lists personal-data spans as JSON.
// If the device model is unavailable or returns junk, the caller must NOT fall back to the cloud with raw text.
import { run } from "./hybrid.js";
import { DEVICE_SCHEMA_PROMPT } from "./redact.js";
import { parseSpans } from "./spans.js";
export { parseSpans };


export function isEcho(raw, text) {
  const s = String(raw);
  return /just echoing back/i.test(s) || (text.length > 40 && s.includes(text));
}

export async function deviceSpans(text, ledger, step = "find personal data") {
  const r = await run("device", [DEVICE_SCHEMA_PROMPT(text)], ledger, { step });
  if (r.source !== "on_device") throw new Error("device pass did not run on device — refusing to continue");
  // Plain Chromium ships a Prompt API stub that echoes the prompt back ("On-device model is not available
  // in Chromium, this API is just echoing back …"). An echo must never count as a check, even if it parses.
  if (isEcho(r.text, text)) throw new Error("on-device model is a stub that echoes the prompt (plain Chromium) — use Chrome with Gemini Nano");
  const spans = parseSpans(r.text, text);
  if (spans === null) throw new Error(`device pass returned no usable JSON: ${JSON.stringify(String(r.text).slice(0, 80))}`);
  return { spans, ms: r.ms };
}
