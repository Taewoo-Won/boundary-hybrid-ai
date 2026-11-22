import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Firebase refuses AI Logic calls without an App Check token (enforced since 2026-11-02), so the deployed
// page must ship a provider. The site key is public; a secret key must never sit next to it.
const pub = JSON.parse(readFileSync(new URL("../src/appcheck.public.json", import.meta.url), "utf8"));

test("appcheck.public.json holds only a public site key field", () => {
  assert.ok("recaptchaEnterpriseSiteKey" in pub);
  for (const k of Object.keys(pub)) assert.doesNotMatch(k, /secret|private|token/i);
});

test("hybrid.js wires the committed key into initializeAppCheck", () => {
  const src = readFileSync(new URL("../src/hybrid.js", import.meta.url), "utf8");
  assert.match(src, /ReCaptchaEnterpriseProvider\(ent\)/);
  assert.match(src, /recaptchaEnterpriseSiteKey/);
  assert.match(src, /initializeAppCheck\(app, \{ provider/);
});

// 11/22 real-PC run: Nano stalled on a cold schema prompt and after 4–5 calls with sessions held open.
test("hybrid.js opens the shared session on warm-up and releases SDK sessions after each call", () => {
  const src = readFileSync(new URL("../src/hybrid.js", import.meta.url), "utf8");
  assert.match(src, /await LM\.create\(textOnly\(\)\);/);
  assert.doesNotMatch(src, /keepAlive/);
  assert.doesNotMatch(src, /responseConstraint:/);  // 11/22: schema-constrained prompts wedged Nano on a real PC
  assert.match(src, /PREFER_ON_DEVICE, onDeviceParams: \{ createOptions: textOnly\(\) \}/);
  assert.doesNotMatch(src.match(/export function textOnly[\s\S]*?\n\}/)[0], /image/);
  assert.match(src, /finally \{ if \(which !== "cloud"\) freeDeviceSession\(models\[which\]\); \}/);
  assert.match(src, /ad\.oldSession\.destroy\?\.\(\)/);
});
