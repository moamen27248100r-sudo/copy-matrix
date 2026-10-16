// Risk level (0265) against SUPABASE_DB_URL: every leader's stored level is the one computed from
// realized volatility, the stats refresh writes the same, and provider_cards (what every screen
// reads) carries it. The checks live in scripts/check-migration-0265.mjs and run inside one
// rolled-back transaction. Run: npm run test:db
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("risk level: one computation from realized volatility, stored and shown as is", () => {
  const r = spawnSync(process.execPath, ["scripts/check-migration-0265.mjs", "--live"], { encoding: "utf8" });
  const failed = (r.stdout ?? "").split("\n").filter((l) => l.startsWith("FAIL"));
  assert.equal(r.status, 0, failed.join("\n") || r.stderr);
  assert.match(r.stdout, /all passed/);
});
