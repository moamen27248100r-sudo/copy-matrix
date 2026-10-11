// Unit tests for the interactive chart's helpers (src/lib/chart-math.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { nearestIndex } from "../src/lib/chart-math.ts";

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
