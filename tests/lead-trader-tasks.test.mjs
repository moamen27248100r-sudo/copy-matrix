// The checklist a self-service lead trader must clear to appear in Discover.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLeadTraderTasks } from "../src/lib/lead-trader-tasks.ts";

const ready = { bio: "Swing trader", symbolBias: ["XAUUSD"], tradingStyle: "swing", closedTrades: 10 };

test("eligible only when profile, trading style and ten closed trades are all done", () => {
  const r = buildLeadTraderTasks(ready);
  assert.equal(r.eligible, true);
  assert.deepEqual(r.tasks.map((t) => t.key), ["profile", "tradingStyle", "firstTenTrades"]);
});

test("each missing item blocks eligibility", () => {
  assert.equal(buildLeadTraderTasks({ ...ready, bio: "" }).eligible, false);
  assert.equal(buildLeadTraderTasks({ ...ready, symbolBias: [] }).eligible, false);
  assert.equal(buildLeadTraderTasks({ ...ready, tradingStyle: null }).eligible, false);
  assert.equal(buildLeadTraderTasks({ ...ready, closedTrades: 9 }).eligible, false);
});

test("missing data never counts as done", () => {
  const r = buildLeadTraderTasks({ bio: null, symbolBias: undefined, tradingStyle: undefined, closedTrades: null });
  assert.equal(r.eligible, false);
  assert.ok(r.tasks.every((t) => t.done === false));
});
