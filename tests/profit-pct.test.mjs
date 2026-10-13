// Unit tests for src/lib/profit-pct.ts: return % = profit / net invested funds.
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatPct, profitPct } from "../src/lib/profit-pct.ts";

test("profit is divided by net invested, not by the current balance", () => {
  // 10,000 put in, 1,000 won: balance is 11,000 -> 10%, not 9.09%.
  assert.equal(profitPct(1000, 10000), 10);
  // 10,000 put in, 1,000 lost: balance is 9,000 -> -10%, not -11.1%.
  assert.equal(profitPct(-1000, 10000), -10);
});

test("withdrawals reduce the base (net invested already accounts for them)", () => {
  // 10,000 in, 5,000 out => 5,000 net; a 500 profit is 10%.
  assert.equal(profitPct(500, 5000), 10);
});

test("no meaningful percentage without invested funds", () => {
  assert.equal(profitPct(100, 0), null);
  assert.equal(profitPct(100, -50), null);
  assert.equal(profitPct(100, null), null);
  assert.equal(profitPct(100, undefined), null);
  assert.equal(profitPct(Number.NaN, 1000), null);
});

test("zero profit is zero percent", () => {
  assert.equal(profitPct(0, 5000), 0);
});

test("formatPct signs and rounding", () => {
  assert.equal(formatPct(3.2), "+3.20%");
  assert.equal(formatPct(-1.054), "-1.05%");
  assert.equal(formatPct(0), "0.00%");
  assert.equal(formatPct(-0.001), "0.00%");
  assert.equal(formatPct(0.004), "0.00%");
  assert.equal(formatPct(null), "—");
  assert.equal(formatPct(undefined), "—");
});
