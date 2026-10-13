// Unit tests for src/lib/portfolio-risk.ts: the portfolio risk indicator.
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeRisk, currentDrawdownPct, leaderRiskLevel } from "../src/lib/portfolio-risk.ts";

test("nothing reserved, no drawdown, no copies is low risk with a zero score", () => {
  const r = computeRisk({ reservedRatio: 0, drawdownPct: 0, leaders: [] });
  assert.equal(r.score, 0);
  assert.equal(r.level, "low");
});

test("reserved share contributes up to 40 points", () => {
  assert.equal(computeRisk({ reservedRatio: 0.5, drawdownPct: 0, leaders: [] }).score, 20);
  assert.equal(computeRisk({ reservedRatio: 1, drawdownPct: 0, leaders: [] }).score, 40);
  assert.equal(computeRisk({ reservedRatio: 3, drawdownPct: 0, leaders: [] }).score, 40);
});

test("drawdown contributes up to 30 points and is capped at 20%", () => {
  assert.equal(computeRisk({ reservedRatio: 0, drawdownPct: 10, leaders: [] }).score, 15);
  assert.equal(computeRisk({ reservedRatio: 0, drawdownPct: 20, leaders: [] }).score, 30);
  assert.equal(computeRisk({ reservedRatio: 0, drawdownPct: 60, leaders: [] }).score, 30);
});

test("trader risk is weighted by the allocated amount", () => {
  // 900 on a high-risk trader and 100 on a low one: average level 2.8 -> 27 points.
  const r = computeRisk({ reservedRatio: 0, drawdownPct: 0, leaders: [{ level: 3, amount: 900 }, { level: 1, amount: 100 }] });
  assert.equal(r.score, 27);
  const allLow = computeRisk({ reservedRatio: 0, drawdownPct: 0, leaders: [{ level: 1, amount: 500 }] });
  assert.equal(allLow.parts.leaders, 0);
  const allHigh = computeRisk({ reservedRatio: 0, drawdownPct: 0, leaders: [{ level: 3, amount: 500 }] });
  assert.equal(allHigh.parts.leaders, 30);
});

test("level thresholds: low under 35, medium under 65, high from 65", () => {
  assert.equal(computeRisk({ reservedRatio: 0.85, drawdownPct: 0, leaders: [] }).level, "low"); // 34
  assert.equal(computeRisk({ reservedRatio: 0.875, drawdownPct: 0, leaders: [] }).level, "medium"); // 35
  assert.equal(computeRisk({ reservedRatio: 1, drawdownPct: 20, leaders: [] }).level, "high"); // 70
  assert.equal(computeRisk({ reservedRatio: 1, drawdownPct: 10, leaders: [] }).level, "medium"); // 55
});

test("a worst case reaches 100", () => {
  const r = computeRisk({ reservedRatio: 1, drawdownPct: 25, leaders: [{ level: 3, amount: 100 }] });
  assert.equal(r.score, 100);
  assert.equal(r.level, "high");
});

test("leaders with a zero amount fall back to an equal average", () => {
  const r = computeRisk({ reservedRatio: 0, drawdownPct: 0, leaders: [{ level: 3, amount: 0 }, { level: 1, amount: 0 }] });
  assert.equal(r.parts.leaders, 15);
});

test("risk labels of the platform map to levels", () => {
  assert.equal(leaderRiskLevel("منخفضة"), 1);
  assert.equal(leaderRiskLevel("متوسطة"), 2);
  assert.equal(leaderRiskLevel("مرتفعة"), 3);
  assert.equal(leaderRiskLevel("غير معروف"), null);
  assert.equal(leaderRiskLevel(null), null);
});

test("drawdown is measured from the peak of the account value", () => {
  // 10,000 invested, +500 then -300 (net +200): peak 10,500, now 10,200 -> 2.857%
  const dd = currentDrawdownPct([{ v: 500 }, { v: -300 }], 10200, 200, 0);
  assert.ok(Math.abs(dd - (300 / 10500) * 100) < 1e-9);
});

test("floating loss counts toward the drawdown; a new high means none", () => {
  const withFloat = currentDrawdownPct([{ v: 100 }], 10100, 100, -200);
  assert.ok(Math.abs(withFloat - (200 / 10100) * 100) < 1e-9);
  assert.equal(currentDrawdownPct([{ v: -50 }, { v: 80 }], 10030, 30, 0), 0);
  assert.equal(currentDrawdownPct([], 0, 0, 0), 0);
});
