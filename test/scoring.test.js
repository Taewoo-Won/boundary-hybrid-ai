import { test } from "node:test";
import assert from "node:assert/strict";
import { score, roleLeaksLabel } from "../eval/scoring.js";

test("role hint sharing a word with a missed label counts as a leak", () => {
  // device missed "Hope Clinic", so safeRole never saw it; the hint "the Hope patient" must still count
  const cases = [{ id: "c1", text: "Maria Lopez was referred by Hope Clinic.", spans: [
    { cls: "NAME", value: "Maria Lopez" }, { cls: "ORG", value: "Hope Clinic" }] }];
  const device = { c1: [{ cls: "NAME", value: "Maria Lopez", role: "the Hope patient" }] };
  assert.equal(score(cases, device).role_hint_leaks, 1);
  assert.equal(score(cases, { c1: [{ cls: "NAME", value: "Maria Lopez", role: "the client" }] }).role_hint_leaks, 0);
});

test("stop words alone are not a leak", () => {
  assert.equal(roleLeaksLabel("the client", [{ value: "The Oak House" }]), false);
  assert.equal(roleLeaksLabel("oak resident", [{ value: "The Oak House" }]), true);
});
