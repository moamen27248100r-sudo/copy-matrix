// Read-only verification of migration 0262 on the live database.   node scripts/verify-migration-0262.mjs
import pg from "pg";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
const results = [];
const ok = (name, pass, extra = "") => results.push({ name, pass, extra: String(extra) });
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
try {
  const t = await c.query("select count(*) n from pg_trigger where tgname = 'trg_profiles_default_watchlist' and not tgisinternal");
  ok("trigger on profiles", Number(t.rows[0].n) === 1);
  const g = await c.query("select has_function_privilege('authenticated', 'public.seed_default_watchlist()', 'execute') a, has_function_privilege('anon', 'public.seed_default_watchlist()', 'execute') n");
  ok("the seeding function is not callable by customers or visitors", g.rows[0].a === false && g.rows[0].n === false);
} catch (e) {
  ok("UNEXPECTED ERROR", false, e.message);
} finally {
  await c.end();
}
for (const r of results) console.log((r.pass ? "PASS " : "FAIL ") + r.name + (r.pass ? "" : "  -> " + r.extra));
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
process.exit(results.every((r) => r.pass) ? 0 : 1);
