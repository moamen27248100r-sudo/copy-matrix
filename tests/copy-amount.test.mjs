// Unit tests for src/lib/copy-amount.ts and src/lib/flash-params.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { copyAmountIssue, defaultCopyAmount } from "../src/lib/copy-amount.ts";
import { withoutFlashParams } from "../src/lib/flash-params.ts";

test("copyAmountIssue flags amounts under the minimum and over the balance", () => {
  assert.equal(copyAmountIssue(10, 50, 10000), "below_min");
  assert.equal(copyAmountIssue(20000, 50, 10000), "above_balance");
  assert.equal(copyAmountIssue(100, 50, 10000), null);
  assert.equal(copyAmountIssue(50, 50, 50), null);
});

test("copyAmountIssue ignores an empty field and an unknown balance", () => {
  assert.equal(copyAmountIssue(Number.NaN, 50, 100), null);
  assert.equal(copyAmountIssue(99999, 50, null), null);
  assert.equal(copyAmountIssue(99999, 50), null);
});

test("defaultCopyAmount starts at the minimum, never above the balance", () => {
  assert.equal(defaultCopyAmount(50, 10000), 50);
  assert.equal(defaultCopyAmount(300, 120), 120);
  assert.equal(defaultCopyAmount(300, 0), 300);
  assert.equal(defaultCopyAmount(300, null), 300);
});

test("withoutFlashParams removes error and success, keeps the rest", () => {
  assert.equal(withoutFlashParams("/trader/1", "?error=x%20y"), "/trader/1");
  assert.equal(withoutFlashParams("/trader/1", "?success=saved&tab=trades"), "/trader/1?tab=trades");
  assert.equal(withoutFlashParams("/discover", "?q=a&error=b", "#copy"), "/discover?q=a#copy");
});

test("withoutFlashParams returns null when there is nothing to remove", () => {
  assert.equal(withoutFlashParams("/discover", "?q=a"), null);
  assert.equal(withoutFlashParams("/discover", ""), null);
});
