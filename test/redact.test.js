import test from "node:test";
import assert from "node:assert/strict";
import { patternSpans, applySpans, rehydrate, leakCheck } from "../src/redact.js";

const note = "Kim Minji (born 1987-04-12) called from 010-1234-5678, email minji.k@example.com. Kim reports insomnia.";

test("redact then rehydrate is lossless", () => {
  const spans = [...patternSpans(note), { cls: "NAME", value: "Kim Minji" }, { cls: "NAME", value: "Kim" }, { cls: "HEALTH", value: "insomnia" }];
  const r = applySpans(note, spans);
  for (const v of ["Kim", "1987-04-12", "010-1234-5678", "minji.k@example.com", "insomnia"]) assert.ok(!r.text.includes(v), v);
  assert.equal(rehydrate(r.text, r.map), note);
  assert.deepEqual(leakCheck(r.text), []);
});

test("cloud answer with placeholders comes back with real values", () => {
  const r = applySpans(note, [{ cls: "NAME", value: "Kim Minji" }]);
  assert.equal(rehydrate("Dear [NAME_1],", r.map), "Dear Kim Minji,");
});

test("hallucinated span not in text is ignored", () => {
  const r = applySpans(note, [{ cls: "NAME", value: "Park" }]);
  assert.equal(r.text, note);
});

test("a date is DOB, not PHONE; national ID and card are ID", () => {
  const s = patternSpans("born 1987-04-12, RRN 870412-2345678, SSN 123-45-6789, card 4111 1111 1111 1111, tel +82 10-1234-5678");
  const by = Object.fromEntries(s.map((x) => [x.value, x.cls]));
  assert.equal(by["1987-04-12"], "DOB");
  assert.equal(by["870412-2345678"], "ID");
  assert.equal(by["123-45-6789"], "ID");
  assert.equal(by["4111 1111 1111 1111"], "ID");
  assert.equal(by["+82 10-1234-5678"], "PHONE");
  assert.equal(s.length, 5);
});

import { parseSpans } from "../src/deviceSpans.js";
test("device JSON parsing keeps only real substrings of known classes", () => {
  const t = "Ana Souza is HIV positive";
  const raw = 'Sure! {"spans":[{"cls":"NAME","value":"Ana Souza"},{"cls":"HEALTH","value":"HIV positive"},{"cls":"NAME","value":"Bob"},{"cls":"PET","value":"Ana"}]}';
  assert.deepEqual(parseSpans(raw, t), [{ cls: "NAME", value: "Ana Souza" }, { cls: "HEALTH", value: "HIV positive" }]);
  assert.equal(parseSpans("no json here", t), null);
});
