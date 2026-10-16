// Dry run of migration 0273 inside ONE rolled-back transaction (or --live against the applied
// version): the 1Y columns are filled for the leaders, equal the 12-month function (0271), the other
// periods and the risk level are unchanged, the view grants are intact, and the rollback restores the
// previous function, view and columns.
//   node scripts/check-migration-0273.mjs [--live]
import { readFileSync } from "node:fs";
import pg from "pg";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const live = process.argv.includes("--live");
const strip = (f) => readFileSync(f, "utf8").replace(/^begin;\s*$/m, "-- begin").replace(/^commit;\s*$/m, "-- commit");
const up = strip("supabase/migrations/0273_leader_period_1y.sql");
const down = strip("supabase/rollback/0273_leader_period_1y.sql");
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
let failed = 0;
let passed = 0;
const check = (ok, msg) => {
  console.log(`${ok ? "PASS" : "FAIL"} ${msg}`);
  ok ? passed++ : failed++;
};
const snapshot = async () =>
  (await c.query("select provider_id, roi_7d, roi_30d, roi_90d, roi_180d, roi_all, trades_180d, win_rate_180d, mdd_180d, risk_level from provider_cards order by provider_id")).rows;
const cols = async () => (await c.query("select column_name from information_schema.columns where table_name='provider_cards' order by ordinal_position")).rows.map((r) => r.column_name);
await c.query("begin");
try {
  await c.query("set local statement_timeout = '600s'");
  const before = await snapshot();
  const colsBefore = await cols();
  const fnBefore = (await c.query("select md5(pg_get_functiondef('public.refresh_provider_stats(uuid[],boolean)'::regprocedure)) h")).rows[0].h;
  if (!live) {
    const t0 = Date.now();
    await c.query(up);
    await c.query("select public.refresh_provider_stats(null, true)");
    console.log(`(apply + full stats refresh: ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  }
  const after = await snapshot();
  const colsAfter = await cols();
  check(colsAfter.slice(-5).join() === "roi_365d,trades_365d,win_rate_365d,mdd_365d,sharpe_365d", "the five 1Y columns are the last ones of the view");
  check(colsAfter.slice(0, -5).join() === colsBefore.filter((x) => !/_365d$/.test(x)).join(), "every earlier column keeps its place");
  const same = before.length === after.length && before.every((b, i) => ["roi_7d", "roi_30d", "roi_90d", "roi_180d", "roi_all", "trades_180d", "win_rate_180d", "mdd_180d", "risk_level"].every((k) => String(b[k]) === String(after[i][k])));
  check(same, `the other periods and the risk level of ${before.length} leaders are unchanged by the refresh`);

  const { rows: f } = await c.query("select count(*)::int n, count(roi_365d)::int roi, count(trades_365d)::int tr, count(mdd_365d)::int dd from provider_cards");
  check(f[0].roi === f[0].n && f[0].tr === f[0].n && f[0].dd === f[0].n, `1Y return, trades and drawdown are filled for all ${f[0].n} leaders`);
  const { rows: ids } = await c.query("select provider_id from provider_cards where track_days >= 400 limit 50");
  const { rows: fn } = await c.query("select * from provider_roi_period($1::uuid[], 365)", [ids.map((r) => r.provider_id)]);
  const { rows: st } = await c.query("select provider_id, roi_365d from provider_cards where provider_id = any($1::uuid[])", [ids.map((r) => r.provider_id)]);
  const m = new Map(st.map((r) => [r.provider_id, Number(r.roi_365d)]));
  const gap = Math.max(...fn.map((r) => Math.abs(Number(r.roi) - m.get(r.provider_id))));
  check(fn.length > 0 && gap < 0.02, `roi_365d equals the 12-month function for ${fn.length} leaders (largest gap ${gap.toFixed(4)} points)`);
  const { rows: mono } = await c.query("select count(*)::int n from provider_cards where trades_365d < trades_180d or trades_365d > trades_all");
  check(mono[0].n === 0, "trades of 1Y are between the 180-day and the all-time counts");
  const { rows: neg } = await c.query("select count(*)::int n from provider_cards where mdd_365d < mdd_180d - 0.01 or mdd_365d > mdd_all + 0.01");
  check(neg[0].n === 0, "the 1Y drawdown sits between the 180-day and the all-time drawdown");
  await c.query("savepoint s");
  await c.query("set local role anon");
  const { rows: an } = await c.query("select count(*)::int n from provider_cards");
  await c.query("rollback to savepoint s");
  check(an[0].n > 0, "anon can still read the view");

  if (!live) {
    await c.query(down);
    check((await cols()).join() === colsBefore.join(), "the rollback restores the previous view columns");
    const fnAfter = (await c.query("select md5(pg_get_functiondef('public.refresh_provider_stats(uuid[],boolean)'::regprocedure)) h")).rows[0].h;
    check(fnAfter === fnBefore, "the rollback restores the previous function exactly");
    const { rows: gone } = await c.query("select count(*)::int n from information_schema.columns where table_name='provider_stats' and column_name like '%_365d'");
    check(gone[0].n === 0, "the rollback drops the 1Y columns");
  }
} catch (e) {
  check(false, `unexpected error: ${e.message}`);
} finally {
  await c.query("rollback");
  await c.end();
}
console.log(failed ? `${failed} FAILED, ${passed} passed` : `all ${passed} passed (rolled back)`);
process.exit(failed ? 1 : 0);
