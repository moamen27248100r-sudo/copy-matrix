// Read-only verification that migration 0254 is applied on the database named by SUPABASE_DB_URL.
//
//   node scripts/verify-migration-0254.mjs
import pg from "pg";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const results = [];
const ok = (name, pass, extra = "") => results.push({ name, pass, extra: String(extra) });

const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
try {
  for (const [fn, args] of [
    ["dashboard_summary", "text"],
    ["benchmark_series", "text, integer"],
  ]) {
    const sig = `public.${fn}(${args})`;
    const r = await c.query("select prosecdef, provolatile from pg_proc where oid = $1::regprocedure", [sig]);
    ok(`${fn}: exists, security definer, stable`, r.rows[0]?.prosecdef === true && r.rows[0]?.provolatile === "s");
    const g = await c.query(
      "select has_function_privilege('anon', $1, 'execute') a, has_function_privilege('authenticated', $1, 'execute') u, has_function_privilege('public', $1, 'execute') p",
      [sig],
    );
    ok(`${fn}: authenticated can execute, anon and public cannot`, g.rows[0].u === true && g.rows[0].a === false && g.rows[0].p === false, JSON.stringify(g.rows[0]));
  }
  // The QA account (demo, no positions needed) gets a document back with the expected keys.
  const claims = JSON.stringify({ sub: (await c.query("select id from profiles where email = 'mo48100r@gmail.com'")).rows[0].id, role: "authenticated", aal: "aal2" });
  await c.query("begin");
  await c.query("select set_config('request.jwt.claims', $1, true)", [claims]);
  await c.query("set local role authenticated");
  const d = (await c.query("select public.dashboard_summary('UTC') d")).rows[0].d;
  await c.query("reset role");
  await c.query("rollback");
  ok("dashboard_summary: document has all sections", ["account_type", "balance", "net_invested", "closed", "open", "by_provider", "by_class", "series"].every((k) => k in d), Object.keys(d).join(","));
} catch (e) {
  ok("UNEXPECTED ERROR", false, e.message);
} finally {
  await c.end();
}

for (const r of results) console.log((r.pass ? "PASS " : "FAIL ") + r.name + (r.pass ? "" : "  -> " + r.extra));
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
process.exit(results.every((r) => r.pass) ? 0 : 1);
