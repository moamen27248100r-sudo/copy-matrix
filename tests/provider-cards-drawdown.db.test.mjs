// provider_cards carries the floating drawdown (0272) against SUPABASE_DB_URL: a new last column,
// earlier columns untouched, grants unchanged, equal to provider_stats, and the rollback restores
// the previous view. Scenarios live in scripts/check-migration-0272.mjs (one rolled-back transaction).
// Run: npm run test:db
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("provider_cards floating drawdown: every scenario passes against the live view", () => {
  const r = spawnSync(process.execPath, ["scripts/check-migration-0272.mjs", "--live"], { encoding: "utf8" });
  const failed = (r.stdout ?? "").split("\n").filter((l) => l.startsWith("FAIL"));
  assert.equal(r.status, 0, failed.join("\n") || r.stderr);
  assert.match(r.stdout, /all \d+ passed/);
});
