// Copy sizing by margin (0263) against SUPABASE_DB_URL: simultaneous trades are all copied, the
// margin share and the leverage follow the leader, a copy without enough free amount opens smaller
// or not at all, and the customer is told and the reason recorded. The scenarios live in
// scripts/check-migration-0263.mjs and run inside one rolled-back transaction. Run: npm run test:db
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("copy sizing by margin: every scenario passes against the live functions", () => {
  const r = spawnSync(process.execPath, ["scripts/check-migration-0263.mjs", "--live"], { encoding: "utf8" });
  const failed = (r.stdout ?? "").split("\n").filter((l) => l.startsWith("FAIL"));
  assert.equal(r.status, 0, failed.join("\n") || r.stderr);
  assert.match(r.stdout, /all \d+ passed/);
});
