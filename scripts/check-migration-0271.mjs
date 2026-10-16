// Dry run of migration 0271 inside ONE rolled-back transaction (or --live against the applied
// function): the 180-day result equals the stored roi_180d for the same leaders, 12 months is
// computed, archived leaders and oversized lists are handled, and the function is callable by the
// public roles but the daily table itself stays closed.
//   node scripts/check-migration-0271.mjs [--live]
import { readFileSync } from "node:fs";
import pg from "pg";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const live = process.argv.includes("--live");
const sql = readFileSync("supabase/migrations/0271_provider_roi_period.sql", "utf8").replace(/^begin;\s*$/m, "-- begin").replace(/^commit;\s*$/m, "-- commit");
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
let failed = 0;
let passed = 0;
const check = (ok, msg) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${msg}`);
  ok ? passed++ : failed++;
};
await c.query("begin");
try {
  if (!live) await c.query(sql);

  const { rows: ids } = await c.query("select provider_id from provider_cards where not is_archived and trades_180d > 20 limit 40");
  const list = ids.map((r) => r.provider_id);
  const { rows: r180 } = await c.query("select * from provider_roi_period($1::uuid[], 180)", [list]);
  const { rows: stored } = await c.query("select provider_id, roi_180d from provider_cards where provider_id = any($1::uuid[])", [list]);
  const sm = new Map(stored.map((r) => [r.provider_id, Number(r.roi_180d)]));
  const worst = Math.max(...r180.map((r) => Math.abs(Number(r.roi) - sm.get(r.provider_id))));
  check(r180.length > 0 && worst < 0.02, `180 days matches the stored roi_180d for ${r180.length} leaders (largest gap ${worst.toFixed(4)} points)`);

  const { rows: r365 } = await c.query("select * from provider_roi_period($1::uuid[])", [list]);
  check(r365.length > 0 && r365.every((r) => r.days_counted >= 1), `12 months computed for ${r365.length} leaders`);
  const longer = r365.filter((r) => r.days_counted > 180).length;
  check(longer > 0, `${longer} leaders have more than 180 days of history in the 12-month window`);

  const { rows: big } = await c.query("select count(*)::int n from provider_roi_period((select array_agg(provider_id) from provider_cards), 365)");
  check(big[0].n <= 50, `a list longer than 50 is cut to 50 (${big[0].n} returned)`);

  const { rows: arch } = await c.query("select id from providers where is_archived limit 1");
  if (arch[0]) {
    const { rows: a } = await c.query("select * from provider_roi_period($1::uuid[])", [[arch[0].id]]);
    check(a.length === 0, "an archived leader returns nothing");
  } else check(true, "no archived leader to test (skipped)");

  const { rows: nul } = await c.query("select count(*)::int n from provider_roi_period(null::uuid[])");
  check(nul[0].n === 0, "a null list returns nothing");

  for (const role of ["anon", "authenticated"]) {
    await c.query("savepoint s");
    await c.query(`set local role ${role}`);
    const { rows } = await c.query("select count(*)::int n from provider_roi_period($1::uuid[])", [list.slice(0, 5)]);
    check(rows[0].n > 0, `${role} can call the function`);
    let blocked = false;
    try {
      await c.query("select 1 from provider_daily limit 1");
    } catch {
      blocked = true;
    }
    await c.query("rollback to savepoint s");
    check(blocked, `${role} still cannot read provider_daily`);
  }
} catch (e) {
  check(false, `unexpected error: ${e.message}`);
} finally {
  await c.query("rollback");
  await c.end();
}
console.log(failed ? `${failed} FAILED, ${passed} passed` : `all ${passed} passed (rolled back)`);
process.exit(failed ? 1 : 0);
