// Read-only verification of migration 0257.   node scripts/verify-migration-0257.mjs
import pg from "pg";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
const results = [];
const ok = (name, pass, extra = "") => results.push({ name, pass, extra: String(extra) });
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
try {
  const f = await c.query("select prosecdef, provolatile from pg_proc where oid = 'public.leader_adjusted_drawdown(uuid[], integer)'::regprocedure");
  ok("function exists, security definer, stable", f.rows[0]?.prosecdef === true && f.rows[0]?.provolatile === "s");
  const g = await c.query("select has_function_privilege('anon', 'public.leader_adjusted_drawdown(uuid[], integer)', 'execute') a, has_function_privilege('authenticated', 'public.leader_adjusted_drawdown(uuid[], integer)', 'execute') u");
  ok("visitors and customers can execute it", g.rows[0].a === true && g.rows[0].u === true);
} catch (e) {
  ok("UNEXPECTED ERROR", false, e.message);
} finally {
  await c.end();
}
for (const r of results) console.log((r.pass ? "PASS " : "FAIL ") + r.name + (r.pass ? "" : "  -> " + r.extra));
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
process.exit(results.every((r) => r.pass) ? 0 : 1);
