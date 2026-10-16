// Price alerts (0266) against SUPABASE_DB_URL: created through the function with the direction
// from the price at that moment, private to their owner, at most 20 active, cancellable by the
// owner only, fired once into a market notification when the price reaches the target. The
// scenarios live in scripts/check-migration-0266.mjs and run in one rolled-back transaction.
// Run: npm run test:db
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("price alerts: every scenario passes against the live functions", () => {
  const r = spawnSync(process.execPath, ["scripts/check-migration-0266.mjs", "--live"], { encoding: "utf8" });
  const failed = (r.stdout ?? "").split("\n").filter((l) => l.startsWith("FAIL"));
  assert.equal(r.status, 0, failed.join("\n") || r.stderr);
  assert.match(r.stdout, /all \d+ passed/);
});
