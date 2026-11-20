import test from "node:test";
import assert from "node:assert/strict";
import { prepare, outgoing, askCloud } from "../src/pipeline.js";
import { SAMPLES } from "../src/samples.js";
import { Ledger } from "../src/ledger.js";

const s = SAMPLES[0];
const fakeDevice = async () => ({ spans: s.spans, ms: 5 });
// a fake cloud that writes a reply using the placeholders it was given
const fakeRun = async (which, parts, ledger, meta = {}) => {
  const body = parts[0].split("\n---\n").pop();
  const names = body.match(/\[NAME_\d+\]/g) ?? [];
  const rec = { which, source: "in_cloud", ms: 1, ...meta, text: `Dear ${names[0]},\nThanks. ${body.slice(0, 40)}` };
  ledger?.add(rec, parts);
  return rec;
};

test("device failure fails closed — nothing reaches the cloud", async () => {
  const led = new Ledger();
  const p = await prepare(s.text, async () => { throw new Error("no Nano"); }, led);
  assert.equal(p.ok, false);
  assert.equal(led.totals().charsOut, 0);
});

test("outgoing text carries no labelled personal data and answer is restored", async () => {
  const p = await prepare(s.text, fakeDevice);
  const out = outgoing(s.text, p.spans, "reply");
  for (const sp of s.spans) assert.ok(!out.prompt.includes(sp.value), sp.value);
  assert.ok(!out.prompt.includes("555-201-4477") && !out.prompt.includes("maria.lopez@example.com"));
  assert.equal(out.blocked, false);
  const led = new Ledger();
  const r = await askCloud(out, fakeRun, led);
  assert.ok(r.final.startsWith("Dear Maria Lopez,"));
  assert.equal(led.totals().cloud, 1);
});

test("unticking a phone number blocks the send", async () => {
  const p = await prepare(s.text, fakeDevice);
  const out = outgoing(s.text, p.spans.filter((x) => x.cls !== "PHONE"), "reply");
  assert.equal(out.blocked, true);
  await assert.rejects(askCloud(out, fakeRun));
});

test("a Prompt API stub that echoes the prompt is rejected (plain Chromium)", async () => {
  const { isEcho } = await import("../src/deviceSpans.js");
  assert.ok(isEcho("On-device model is not available in Chromium, this API is just echoing back the input", s.text));
  assert.ok(isEcho(`{"spans":[]} ${s.text}`, s.text));
  assert.ok(!isEcho('{"spans":[{"cls":"NAME","value":"Maria Lopez"}]}', s.text));
});

test("on-device re-check of the outgoing text catches what the first pass missed", async () => {
  const { residualCheck } = await import("../src/pipeline.js");
  const out = outgoing(s.text, s.spans.filter((x) => x.value !== "Ana").concat([]), "reply");
  assert.ok(out.prompt.includes("Ana"));
  const dev = async (t) => ({ spans: [{ cls: "NAME", value: "Ana" }, { cls: "NAME", value: "[NAME_1]" }].filter((x) => t.includes(x.value)), ms: 1 });
  const rc = await residualCheck(out, dev);
  assert.deepEqual(rc.spans.map((x) => x.value), ["Ana"]); // placeholders are not personal data
  const bad = await residualCheck(out, async () => { throw new Error("no Nano"); });
  assert.equal(bad.ok, false);
});

test("answer check flags personal data the cloud invented", async () => {
  const { checkAnswer } = await import("../src/pipeline.js");
  const run = async () => ({ source: "on_device", text: '{"spans":[{"cls":"NAME","value":"Dr. Rivera"}]}' });
  const r = await checkAnswer("Dear [NAME_1], Dr. Rivera can see you; call 555-777-1234.", run);
  assert.deepEqual(r.flagged.map((x) => x.value).sort(), ["555-777-1234", "Dr. Rivera"]);
});

test("role hints reach the cloud only when they cannot identify", async () => {
  const { safeRole } = await import("../src/redact.js");
  const out = outgoing(s.text, s.spans, "reply");
  assert.match(out.prompt, /\[NAME_\d\] = the client, she/);
  assert.match(out.prompt, /= a medication/);
  for (const sp of s.spans) assert.ok(!out.prompt.includes(sp.value), sp.value);
  assert.equal(safeRole("Maria's doctor", ["Maria Lopez"]), "");   // repeats a kept-back word
  assert.equal(safeRole("born 1979", ["x"]), "");                  // digits
  assert.equal(safeRole("call me at a@example.com", ["x"]), "");   // pattern
  assert.equal(safeRole("the client, she", ["Maria Lopez"]), "the client, she");
});
