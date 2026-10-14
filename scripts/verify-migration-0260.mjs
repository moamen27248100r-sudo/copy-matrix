// Read-only verification of migration 0260 on the live database.   node scripts/verify-migration-0260.mjs
import pg from "pg";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
const results = [];
const ok = (name, pass, extra = "") => results.push({ name, pass, extra: String(extra) });
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
try {
  const t = await c.query("select count(*) n from information_schema.tables where table_schema = 'public' and table_name in ('push_subscriptions', 'push_outbox')");
  ok("both tables exist", Number(t.rows[0].n) === 2);
  const rls = await c.query("select relname, relrowsecurity r from pg_class where oid in ('public.push_subscriptions'::regclass, 'public.push_outbox'::regclass)");
  ok("row level security on both", rls.rows.every((r) => r.r === true));
  const keys = await c.query("select has_column_privilege('authenticated', 'public.push_subscriptions', 'p256dh', 'select') a, has_column_privilege('authenticated', 'public.push_subscriptions', 'auth', 'select') b, has_table_privilege('authenticated', 'public.push_outbox', 'select') o");
  ok("device keys and the outbox are closed to customers", keys.rows[0].a === false && keys.rows[0].b === false && keys.rows[0].o === false);
  const trg = await c.query("select count(*) n from pg_trigger where tgname = 'trg_notifications_push_outbox'");
  ok("trigger on notifications", Number(trg.rows[0].n) === 1);
  const job = await c.query("select count(*) n from cron.job where jobname = 'push-dispatch'");
  ok("scheduled job", Number(job.rows[0].n) === 1);
} catch (e) {
  ok("UNEXPECTED ERROR", false, e.message);
} finally {
  await c.end();
}
for (const r of results) console.log((r.pass ? "PASS " : "FAIL ") + r.name + (r.pass ? "" : "  -> " + r.extra));
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
process.exit(results.every((r) => r.pass) ? 0 : 1);
