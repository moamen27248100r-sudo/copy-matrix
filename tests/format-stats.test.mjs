// Unit tests for the leader statistics formatters (src/lib/format-stats.ts):
// the same number must read the same on a card, in the table and on the profile.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fmtDrawdown, fmtReturn, fmtWinRate, nameIsolate } from "../src/lib/format-stats.ts";

test("fmtReturn: two decimals, plus sign only when positive", () => {
  assert.equal(fmtReturn(7.44), "+7.44%");
  assert.equal(fmtReturn(7.4), "+7.40%");
  assert.equal(fmtReturn(-0.08), "-0.08%");
  assert.equal(fmtReturn(0), "0.00%");
});

test("fmtReturn: values that round to zero have no sign", () => {
  assert.equal(fmtReturn(0.004), "0.00%");
  assert.equal(fmtReturn(-0.004), "0.00%");
});

test("fmtDrawdown: always a loss with a minus sign, whatever the stored sign", () => {
  assert.equal(fmtDrawdown(3.02), "-3.02%");
  assert.equal(fmtDrawdown(-3.02), "-3.02%");
  assert.equal(fmtDrawdown(10.5), "-10.50%");
  assert.equal(fmtDrawdown(0), "0.00%");
  assert.equal(fmtDrawdown(0.001), "0.00%");
});

test("fmtWinRate: one decimal", () => {
  assert.equal(fmtWinRate(71), "71.0%");
  assert.equal(fmtWinRate(48.8), "48.8%");
  assert.equal(fmtWinRate(100), "100.0%");
});

test("missing or non-finite values are an em dash", () => {
  for (const f of [fmtReturn, fmtDrawdown, fmtWinRate]) {
    assert.equal(f(null), "—");
    assert.equal(f(undefined), "—");
    assert.equal(f(Number.NaN), "—");
  }
});

test("nameIsolate: a name in another script is one isolated unit inside the sentence", () => {
  assert.equal(nameIsolate("أنس ريان"), "⁨أنس ريان⁩");
  assert.equal(nameIsolate(null), "⁨⁩");
  assert.equal(nameIsolate("Léo Fournier").length, "Léo Fournier".length + 2);
});
