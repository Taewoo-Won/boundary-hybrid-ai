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
