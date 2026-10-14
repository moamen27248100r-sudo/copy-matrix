// Read-only verification of migration 0259 on the live database.   node scripts/verify-migration-0259.mjs
import pg from "pg";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
const results = [];
const ok = (name, pass, extra = "") => results.push({ name, pass, extra: String(extra) });
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
try {
  for (const fn of ["market_snapshot()", "market_series(text, integer)", "top_leaders_for_symbol(text, integer)", "generate_market_alerts()"]) {
    const r = await c.query("select to_regprocedure($1) p", [`public.${fn}`]);
    ok(`function ${fn} exists`, r.rows[0].p != null);
  }
  const g = await c.query(
    "select has_function_privilege('authenticated', 'public.market_snapshot()', 'execute') a, has_function_privilege('anon', 'public.market_snapshot()', 'execute') n, has_function_privilege('authenticated', 'public.generate_market_alerts()', 'execute') gen",
  );
  ok("customers can read the snapshot, visitors cannot, nobody but the service role generates alerts", g.rows[0].a === true && g.rows[0].n === false && g.rows[0].gen === false);
  const t = await c.query("select count(*) n from information_schema.tables where table_schema = 'public' and table_name in ('market_watchlist', 'market_alert_log')");
  ok("tables exist", Number(t.rows[0].n) === 2);
  const rls = await c.query("select relrowsecurity r from pg_class where oid = 'public.market_watchlist'::regclass");
  ok("watchlist has row level security", rls.rows[0].r === true);
  const con = await c.query("select pg_get_constraintdef(oid) d from pg_constraint where conname = 'notification_preferences_category_check'");
  ok("preferences accept the market category", /market/.test(con.rows[0]?.d ?? ""));
  const cat = await c.query("select notification_category('market_move') c");
  ok("market_move belongs to the market category", cat.rows[0].c === "market");
  const jobs = await c.query("select jobname from cron.job where jobname in ('market-alerts', 'market-alert-log-prune')");
  ok("both scheduled jobs exist", jobs.rows.length === 2, jobs.rows.map((r) => r.jobname).join(","));
  const snap = await c.query("select count(*) n from market_snapshot()");
  ok("snapshot answers", Number(snap.rows[0].n) === 9, snap.rows[0].n);
} catch (e) {
  ok("UNEXPECTED ERROR", false, e.message);
} finally {
  await c.end();
}
for (const r of results) console.log((r.pass ? "PASS " : "FAIL ") + r.name + (r.pass ? "" : "  -> " + r.extra));
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
process.exit(results.every((r) => r.pass) ? 0 : 1);
