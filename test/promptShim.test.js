import test from "node:test";
import assert from "node:assert/strict";
import { flattenPrompt, shimLanguageModel } from "../src/promptShim.js";

test("one user text message becomes a plain string; other shapes pass through", () => {
  assert.equal(flattenPrompt([{ role: "user", content: [{ type: "text", value: "hi" }] }]), "hi");
  const two = [{ role: "user", content: [{ type: "text", value: "a" }] }, { role: "assistant", content: [{ type: "text", value: "b" }] }];
  assert.equal(flattenPrompt(two), two);
  const img = [{ role: "user", content: [{ type: "image", value: {} }] }];
  assert.equal(flattenPrompt(img), img);
  assert.equal(flattenPrompt("plain"), "plain");
});

test("shim wraps create so sessions receive the flattened prompt, once", async () => {
  const seen = [];
  const LM = { create: async () => ({ prompt: async (i, o) => { seen.push([i, o]); return "ok"; } }) };
  assert.equal(shimLanguageModel(LM), true);
  assert.equal(shimLanguageModel(LM), false);
  const s = await LM.create({});
  await s.prompt([{ role: "user", content: [{ type: "text", value: "x" }] }], { responseConstraint: 1 });
  assert.deepEqual(seen, [["x", { responseConstraint: 1 }]]);
});

test("prompt() is served from promptStreaming when the session has it", async () => {
  const LM = { create: async () => ({ prompt: async () => "unused",
    promptStreaming: (i, o) => (async function* () { yield `{"a":`; yield `"${i}"}`; })() }) };
  shimLanguageModel(LM);
  const s = await LM.create({});
  assert.equal(await s.prompt([{ role: "user", content: [{ type: "text", value: "q" }] }], {}), '{"a":"q"}');
});
