// Batch loading of a leader's trade history (src/lib/trade-paging.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { afterCursorFilter, cursorOf, isUnfiltered, mergeBatch, splitBatch, tradeFilterFor, TRADES_BATCH } from "../src/lib/trade-paging.ts";

const NOW = Date.UTC(2026, 9, 11, 15, 30, 0); // 2026-10-11 15:30 UTC

test("a batch is 50 trades", () => {
  assert.equal(TRADES_BATCH, 50);
});

test("period filters start at the UTC day N-1 days back; all has no bounds", () => {
  assert.deepEqual(tradeFilterFor("all", null, null, NOW), { from: null, to: null, symbol: null });
  assert.equal(tradeFilterFor("today", null, null, NOW).from, "2026-10-11T00:00:00.000Z");
  assert.equal(tradeFilterFor("week", null, null, NOW).from, "2026-10-05T00:00:00.000Z");
  assert.equal(tradeFilterFor("month", null, null, NOW).from, "2026-09-12T00:00:00.000Z");
  assert.equal(tradeFilterFor("year", null, null, NOW).from, "2025-10-12T00:00:00.000Z");
});

test("a custom range covers both end days; invalid ranges select everything", () => {
  const f = tradeFilterFor("custom", { from: "2026-09-01", to: "2026-09-30" }, null, NOW);
  assert.equal(f.from, "2026-09-01T00:00:00.000Z");
  assert.equal(f.to, "2026-10-01T00:00:00.000Z");
  assert.deepEqual(tradeFilterFor("custom", { from: "2026-09-30", to: "2026-09-01" }, null, NOW), { from: null, to: null, symbol: null });
  assert.deepEqual(tradeFilterFor("custom", { from: "x", to: "y" }, null, NOW), { from: null, to: null, symbol: null });
  assert.deepEqual(tradeFilterFor("custom", null, null, NOW), { from: null, to: null, symbol: null });
});

test("the symbol rides along; empty means none", () => {
  assert.equal(tradeFilterFor("all", null, "XAUUSD", NOW).symbol, "XAUUSD");
  assert.equal(tradeFilterFor("all", null, "", NOW).symbol, null);
});

test("isUnfiltered is true only with no period bounds and no symbol", () => {
  assert.equal(isUnfiltered(tradeFilterFor("all", null, null, NOW)), true);
  assert.equal(isUnfiltered(tradeFilterFor("week", null, null, NOW)), false);
  assert.equal(isUnfiltered(tradeFilterFor("all", null, "BTCUSDT", NOW)), false);
});

test("cursor comes from the last trade and needs a close time", () => {
  assert.deepEqual(cursorOf({ id: "a", closedAt: "2026-10-09T16:42:00+00:00" }), { id: "a", closedAt: "2026-10-09T16:42:00+00:00" });
  assert.equal(cursorOf({ id: "a", closedAt: null }), null);
});

test("the cursor filter is strictly-after in (closed_at desc, id desc) order", () => {
  assert.equal(
    afterCursorFilter({ closedAt: "2026-10-09T16:42:00+00:00", id: "abc" }),
    "closed_at.lt.2026-10-09T16:42:00+00:00,and(closed_at.eq.2026-10-09T16:42:00+00:00,id.lt.abc)",
  );
});

test("batches merge without duplicates, keeping order", () => {
  const a = [{ id: "1" }, { id: "2" }];
  assert.deepEqual(mergeBatch(a, [{ id: "2" }, { id: "3" }]).map((t) => t.id), ["1", "2", "3"]);
  assert.deepEqual(mergeBatch(a, [{ id: "1" }]).map((t) => t.id), ["1", "2"]);
  assert.deepEqual(mergeBatch([], [{ id: "9" }]).map((t) => t.id), ["9"]);
});

test("limit+1 rows mean more exist; fewer mean the end", () => {
  const rows = Array.from({ length: 51 }, (_, i) => i);
  const full = splitBatch(rows, 50);
  assert.equal(full.batch.length, 50);
  assert.equal(full.hasMore, true);
  const last = splitBatch(rows.slice(0, 50), 50);
  assert.equal(last.batch.length, 50);
  assert.equal(last.hasMore, false);
  assert.deepEqual(splitBatch([], 50), { batch: [], hasMore: false });
});
