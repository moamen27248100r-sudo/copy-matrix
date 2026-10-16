// Account hardening (0270) against SUPABASE_DB_URL: e-mail unique after trim+lowercase, phone in
// E.164 and unique, no negative balance, e-mail verification before real deposits and withdrawals,
// rate limits per e-mail, one-time idempotency keys. The scenarios live in
// scripts/check-migration-0270.mjs and run in one rolled-back transaction.
// Run: npm run test:db
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("account hardening: every scenario passes against the live functions", () => {
  const r = spawnSync(process.execPath, ["scripts/check-migration-0270.mjs", "--live"], { encoding: "utf8" });
  const failed = (r.stdout ?? "").split("\n").filter((l) => l.startsWith("FAIL"));
  assert.equal(r.status, 0, failed.join("\n") || r.stderr);
  assert.match(r.stdout, /all \d+ passed/);
});
