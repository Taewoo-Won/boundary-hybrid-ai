// Cloud-path smoke test: one tiny request to Firebase AI Logic (Gemini Developer API) with the public web config,
// sent the way the deployed page sends it (same endpoint, API key header, page origin as Referer).
// Prints the HTTP status and a short reason, so a CI run shows whether the cloud step works before a demo.
// With APPCHECK_TOKEN set (a registered debug token exchanged elsewhere) it also sends the App Check header.
import { readFileSync } from "node:fs";

const cfg = JSON.parse(readFileSync(new URL("../src/firebase.public.json", import.meta.url), "utf8"));
const model = process.env.MODEL || "gemini-3.5-flash-lite"; // SDK default for hybrid in-cloud (firebase 13.4)
const origin = process.env.PAGE_ORIGIN || "https://taewoo-won.github.io";
const url = `https://firebasevertexai.googleapis.com/v1beta/projects/${cfg.projectId}/models/${model}:generateContent`;
const headers = {
  "Content-Type": "application/json",
  "x-goog-api-key": cfg.apiKey,
  "X-Firebase-Appid": cfg.appId,
  Referer: origin + "/",
  Origin: origin,
};
if (process.env.APPCHECK_TOKEN) headers["X-Firebase-AppCheck"] = process.env.APPCHECK_TOKEN;
const body = { contents: [{ role: "user", parts: [{ text: "Reply with the single word: ok" }] }] };

const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
const json = await res.json().catch(() => ({}));
const answer = json?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("").trim();
const err = json?.error;
console.log(`model=${model} status=${res.status}`);
if (answer) console.log(`answer=${answer.slice(0, 80)}`);
if (err) {
  console.log(`error.status=${err.status} message=${String(err.message).slice(0, 300)}`);
  for (const d of err.details || []) if (d.reason || d.metadata) console.log(`detail reason=${d.reason} metadata=${JSON.stringify(d.metadata || {}).slice(0, 300)}`);
}
process.exit(res.ok ? 0 : 1);
