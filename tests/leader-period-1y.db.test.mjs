// The 1Y leader period (0273) against SUPABASE_DB_URL: filled for every leader, equal to the 12-month
// function, other periods and risk levels untouched. Scenarios live in scripts/check-migration-0273.mjs.
// Run: npm run test:db
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("leader 1Y period: every scenario passes against the live database", () => {
  const r = spawnSync(process.execPath, ["scripts/check-migration-0273.mjs", "--live"], { encoding: "utf8" });
  const failed = (r.stdout ?? "").split("\n").filter((l) => l.startsWith("FAIL"));
  assert.equal(r.status, 0, failed.join("\n") || r.stderr);
  assert.match(r.stdout, /all \d+ passed/);
});
