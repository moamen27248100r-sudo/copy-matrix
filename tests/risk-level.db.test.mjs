// Risk level (0265, 0269) against SUPABASE_DB_URL: every leader's stored level is the higher of the
// volatility level and the drawdown level, nobody at 30%+ drawdown is shown low or medium, the stats
// refresh writes the same, and provider_cards (what every screen
// reads) carries it. The checks live in scripts/check-migration-0269.mjs and run inside one
// rolled-back transaction. Run: npm run test:db
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("risk level: the higher of volatility and drawdown, stored and shown as is", () => {
  const r = spawnSync(process.execPath, ["scripts/check-migration-0269.mjs", "--live"], { encoding: "utf8" });
  const failed = (r.stdout ?? "").split("\n").filter((l) => l.startsWith("FAIL"));
  assert.equal(r.status, 0, failed.join("\n") || r.stderr);
  assert.match(r.stdout, /all \d+ passed/);
});
