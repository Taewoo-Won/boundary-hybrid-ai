import test from "node:test";
import assert from "node:assert/strict";
import { flattenPrompt, shimLanguageModel } from "../src/promptShim.js";

const msg = (v) => [{ role: "user", content: [{ type: "text", value: v }] }];

test("one user text message becomes a plain string; other shapes pass through", () => {
  assert.equal(flattenPrompt(msg("hi")), "hi");
  const two = [...msg("a"), { role: "assistant", content: [{ type: "text", value: "b" }] }];
  assert.equal(flattenPrompt(two), two);
  const img = [{ role: "user", content: [{ type: "image", value: {} }] }];
  assert.equal(flattenPrompt(img), img);
  assert.equal(flattenPrompt("plain"), "plain");
});

test("one shared session per options; destroy is a no-op; prompt() collects the stream; calls run one at a time", async () => {
  let made = 0, destroyed = 0, active = 0, maxActive = 0;
  const LM = { create: async () => { made++; return {
    prompt: async () => "unused", destroy: () => destroyed++,
    promptStreaming: (i) => (async function* () { active++; maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 5)); yield `<${i}`; yield ">"; active--; })() }; } };
  assert.equal(shimLanguageModel(LM), true);
  assert.equal(shimLanguageModel(LM), false);
  const opts = { expectedInputs: [{ type: "text" }] };
  const a = await LM.create(opts), b = await LM.create({ ...opts, monitor: () => {} });
  a.destroy(); b.destroy();
  const [x, y] = await Promise.all([a.prompt(msg("x"), {}), b.prompt(msg("y"), {})]);
  assert.deepEqual([x, y, made, destroyed, maxActive], ["<x>", "<y>", 1, 0, 1]);
});
