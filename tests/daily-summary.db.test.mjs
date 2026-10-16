// Optional daily summary (0268) against SUPABASE_DB_URL: off until switched on, one notice for the
// account in use with the day's closed copied trades, their result and the open ones, nothing on a
// quiet day, no email for demo trading. Scenarios in scripts/check-migration-0268.mjs, run in one
// rolled-back transaction. Run: npm run test:db
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("daily summary: every scenario passes against the live functions", () => {
  const r = spawnSync(process.execPath, ["scripts/check-migration-0268.mjs", "--live"], { encoding: "utf8" });
  const failed = (r.stdout ?? "").split("\n").filter((l) => l.startsWith("FAIL"));
  assert.equal(r.status, 0, failed.join("\n") || r.stderr);
  assert.match(r.stdout, /all \d+ passed/);
});
