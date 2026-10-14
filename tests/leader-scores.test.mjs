// Unit tests for the sample-size rule and the floating-aware drawdown in src/lib/leader-scores.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { MIN_CLOSED_TRADES, adjustedMaxDrawdown, hasEnoughSample, maxDrawdownWithFloating } from "../src/lib/leader-scores.ts";

const HOUR = 3600_000;
const T0 = Date.UTC(2026, 0, 1);
const trade = (openH, closeH, pnl, worst = null, worstH = null) => ({
  o: T0 + openH * HOUR,
  c: closeH == null ? null : T0 + closeH * HOUR,
  pnl,
  worst,
  wt: worstH == null ? null : T0 + worstH * HOUR,
});

test("a period needs at least 20 closed trades", () => {
  assert.equal(MIN_CLOSED_TRADES, 20);
  assert.equal(hasEnoughSample(19), false);
  assert.equal(hasEnoughSample(20), true);
  assert.equal(hasEnoughSample("35"), true);
  assert.equal(hasEnoughSample(null), false);
  assert.equal(hasEnoughSample(undefined), false);
});

test("closed trades only: the usual peak-to-trough drop", () => {
  // 1000 -> 1100 -> 990 : drop of 110 from a 1100 peak = 10%
  const dd = maxDrawdownWithFloating([trade(0, 1, 100), trade(2, 3, -110)], 1000, T0 + 10 * HOUR);
  assert.equal(dd, 10);
});

test("a trade that dipped before it recovered counts its worst point", () => {
  // closed +50 overall, but it was 200 under water at hour 5; peak 1000 (start) -> 800 = 20%
  const dd = maxDrawdownWithFloating([trade(0, 10, 50, -200, 5)], 1000, T0 + 20 * HOUR);
  assert.equal(dd, 20);
});

test("the floating loss is added to what was already realized by that moment", () => {
  // +100 realized by hour 2 (peak 1100); a later trade is 150 under at hour 6 => (1100-(1100-150))/1100
  const dd = maxDrawdownWithFloating([trade(0, 2, 100), trade(3, 9, 20, -150, 6)], 1000, T0 + 20 * HOUR);
  assert.equal(dd, Math.round((150 / 1100) * 10000) / 100);
});

test("an open trade contributes its worst floating result", () => {
  const dd = maxDrawdownWithFloating([trade(0, null, null, -50, 1)], 500, T0 + 5 * HOUR);
  assert.equal(dd, 10);
});

test("without price history the trade is bounded by its final result at its close", () => {
  const dd = maxDrawdownWithFloating([trade(0, 4, -80)], 1000, T0 + 10 * HOUR);
  assert.equal(dd, 8);
});

test("no start equity, no figure", () => {
  assert.equal(maxDrawdownWithFloating([trade(0, 1, 10)], 0, T0), null);
});

test("never lower than the stored figure", () => {
  assert.equal(adjustedMaxDrawdown(12.5, 8), 12.5);
  assert.equal(adjustedMaxDrawdown(5, 9.37), 9.37);
  assert.equal(adjustedMaxDrawdown(null, 4), 4);
  assert.equal(adjustedMaxDrawdown(6, null), 6);
  assert.equal(adjustedMaxDrawdown(null, null), null);
});
