// Read-only verification that migration 0255 is applied on the database named by SUPABASE_DB_URL.
//
//   node scripts/verify-migration-0255.mjs
import pg from "pg";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const results = [];
const ok = (name, pass, extra = "") => results.push({ name, pass, extra: String(extra) });

const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
try {
  const fns = [
    ["benchmark_bundle()", { authenticated: true, anon: false }],
    ["portfolio_summary(text)", { authenticated: true, anon: false }],
    ["set_loss_alert(uuid, numeric)", { authenticated: true, anon: false }],
    ["evaluate_loss_alerts()", { authenticated: false, anon: false }],
    ["refresh_benchmark_cache()", { authenticated: false, anon: false }],
    ["dashboard_summary(text)", { authenticated: true, anon: false }],
  ];
  for (const [sig, want] of fns) {
    const full = `public.${sig}`;
    const g = await c.query("select has_function_privilege('authenticated', $1, 'execute') u, has_function_privilege('anon', $1, 'execute') a, has_function_privilege('public', $1, 'execute') p", [full]);
    ok(`${sig}: execute rights as intended`, g.rows[0].u === want.authenticated && g.rows[0].a === want.anon && g.rows[0].p === false, JSON.stringify(g.rows[0]));
  }
  const t = await c.query("select (select count(*) from benchmark_cache) cache, (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'loss_alert_rules') rules");
  ok("benchmark_cache is filled (2 symbols x 6 periods)", Number(t.rows[0].cache) === 12, t.rows[0].cache);
  ok("loss_alert_rules exists", Number(t.rows[0].rules) === 1);
  const g2 = await c.query("select has_table_privilege('authenticated', 'public.loss_alert_rules', 'select') s, has_table_privilege('authenticated', 'public.loss_alert_rules', 'insert') i, has_table_privilege('authenticated', 'public.benchmark_cache', 'select') b");
  ok("customers can only read their rules; cache table is closed", g2.rows[0].s === true && g2.rows[0].i === false && g2.rows[0].b === false, JSON.stringify(g2.rows[0]));
  const jobs = await c.query("select jobname, schedule, active from cron.job where jobname in ('refresh-benchmark-cache', 'evaluate-loss-alerts') order by 1");
  ok("both cron jobs scheduled and active", jobs.rows.length === 2 && jobs.rows.every((j) => j.active), JSON.stringify(jobs.rows));
  const cat = await c.query("select public.notification_category('loss_alert') c");
  ok("loss_alert notifications use the copy category", cat.rows[0].c === "copy");
  const age = await c.query("select max(updated_at) m from benchmark_cache");
  ok("benchmark cache is fresh (< 15 min)", Date.now() - new Date(age.rows[0].m).getTime() < 15 * 60 * 1000, age.rows[0].m);
} catch (e) {
  ok("UNEXPECTED ERROR", false, e.message);
} finally {
  await c.end();
}

for (const r of results) console.log((r.pass ? "PASS " : "FAIL ") + r.name + (r.pass ? "" : "  -> " + r.extra));
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
process.exit(results.every((r) => r.pass) ? 0 : 1);
