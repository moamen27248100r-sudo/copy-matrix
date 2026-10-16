// The 12-month leader return (0271) against SUPABASE_DB_URL: equals the stored 180-day figure for
// 180 days, public roles can call it but not read the daily table, archived leaders and oversized
// lists are handled. Scenarios live in scripts/check-migration-0271.mjs (one rolled-back transaction).
// Run: npm run test:db
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("leader return over a period: every scenario passes against the live function", () => {
  const r = spawnSync(process.execPath, ["scripts/check-migration-0271.mjs", "--live"], { encoding: "utf8" });
  const failed = (r.stdout ?? "").split("\n").filter((l) => l.startsWith("FAIL"));
  assert.equal(r.status, 0, failed.join("\n") || r.stderr);
  assert.match(r.stdout, /all \d+ passed/);
});
