// Unit tests for the interactive chart's helpers (src/lib/chart-math.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { nearestIndex, periodChange } from "../src/lib/chart-math.ts";

test("nearestIndex: picks the closest point", () => {
  const xs = [0, 10, 20, 40];
  assert.equal(nearestIndex(xs, 0), 0);
  assert.equal(nearestIndex(xs, 4), 0);
  assert.equal(nearestIndex(xs, 6), 1);
  assert.equal(nearestIndex(xs, 14), 1);
  assert.equal(nearestIndex(xs, 31), 3);
});

test("nearestIndex: clamps outside the range and handles ties", () => {
  const xs = [5, 15, 25];
  assert.equal(nearestIndex(xs, -100), 0);
  assert.equal(nearestIndex(xs, 100), 2);
  assert.equal(nearestIndex(xs, 10), 0, "a tie goes to the earlier point");
});

test("nearestIndex: degenerate inputs", () => {
  assert.equal(nearestIndex([], 3), -1);
  assert.equal(nearestIndex([7], 3), 0);
  assert.equal(nearestIndex([7], 99), 0);
});

test("periodChange: absolute and relative move against the period start", () => {
  const v = [100, 110, 90];
  assert.deepEqual(periodChange(v, 0), { abs: 0, pct: 0 });
  const up = periodChange(v, 1);
  assert.equal(up.abs, 10);
  assert.equal(up.pct, 10);
  const down = periodChange(v, 2);
  assert.equal(down.abs, -10);
  assert.equal(down.pct, -10);
});

test("periodChange: a series starting at zero has no ratio", () => {
  assert.deepEqual(periodChange([0, 2.5, 7.44], 2), { abs: 7.44, pct: null });
});

test("periodChange: negative start uses its magnitude; index is clamped", () => {
  const r = periodChange([-50, -25], 1);
  assert.equal(r.abs, 25);
  assert.equal(r.pct, 50);
  assert.deepEqual(periodChange([1, 2], 99), { abs: 1, pct: 100 });
  assert.deepEqual(periodChange([], 0), { abs: 0, pct: null });
});
