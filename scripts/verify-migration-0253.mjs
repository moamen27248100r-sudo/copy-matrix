// Read-only verification that migration 0253 is applied on the database named by SUPABASE_DB_URL.
//
//   node scripts/verify-migration-0253.mjs
import pg from "pg";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const results = [];
const ok = (name, pass, extra = "") => results.push({ name, pass, extra: String(extra) });

const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
try {
  for (const t of ["signals", "providers", "simulated_positions"]) {
    const g = await c.query(
      "select privilege_type from information_schema.role_table_grants where table_schema = 'public' and table_name = $1 and grantee = 'authenticated'",
      [t],
    );
    const held = g.rows.map((r) => r.privilege_type);
    ok(`${t}: authenticated holds no INSERT/UPDATE/DELETE`, !held.some((p) => ["INSERT", "UPDATE", "DELETE"].includes(p)), held.join(","));
    const sel = await c.query("select has_any_column_privilege('authenticated', $1, 'SELECT') s", ['public.' + t]);
    ok(`${t}: authenticated can still read`, sel.rows[0].s === true);
  }
  const fn = await c.query("select prosecdef from pg_proc where proname = 'signal_created_by_admin' and pronamespace = 'public'::regnamespace");
  ok("helper signal_created_by_admin exists and is security definer", fn.rows[0]?.prosecdef === true);
  const pol = await c.query("select with_check from pg_policies where tablename = 'simulated_positions' and policyname = 'simulated_positions_insert_admin'");
  ok("insert policy no longer subqueries signals directly", pol.rows[0] && !/from\s+(public\.)?signals/i.test(pol.rows[0].with_check ?? ""), pol.rows[0]?.with_check);
  const sr = await c.query("select has_table_privilege('service_role', 'public.signals', 'INSERT') a, has_table_privilege('service_role', 'public.providers', 'UPDATE') b");
  ok("service_role keeps write access", sr.rows[0].a && sr.rows[0].b);
} catch (e) {
  ok("UNEXPECTED ERROR", false, e.message);
} finally {
  await c.end();
}

for (const r of results) console.log((r.pass ? "PASS " : "FAIL ") + r.name + (r.pass ? "" : "  -> " + r.extra));
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
process.exit(results.every((r) => r.pass) ? 0 : 1);
