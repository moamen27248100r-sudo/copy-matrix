// Read-only verification of migration 0258 on the live database.   node scripts/verify-migration-0258.mjs
import pg from "pg";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
const results = [];
const ok = (name, pass, extra = "") => results.push({ name, pass, extra: String(extra) });
const PRIVATE = ["total_profit", "total_withdrawals", "account_capital", "total_deposits", "pnl_7d", "pnl_30d", "pnl_90d", "pnl_180d", "pnl_all", "aum"];
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
try {
  const cols = (await c.query("select column_name from information_schema.columns where table_schema='public' and table_name='provider_cards'")).rows.map((r) => r.column_name);
  ok("view has no private column", PRIVATE.every((p) => !cols.includes(p)), PRIVATE.filter((p) => cols.includes(p)).join(","));
  ok("view has aum_band", cols.includes("aum_band"));
  for (const col of ["total_profit", "total_withdrawals", "account_capital"]) {
    const r = await c.query("select has_column_privilege('authenticated', 'public.providers', $1, 'select') a, has_column_privilege('anon', 'public.providers', $1, 'select') n", [col]);
    ok(`providers.${col}: closed to customers and visitors`, r.rows[0].a === false && r.rows[0].n === false);
  }
  const r = await c.query("select has_column_privilege('authenticated', 'public.providers', 'display_name', 'select') a");
  ok("providers.display_name still readable", r.rows[0].a === true);
  const n = await c.query("select count(*) n from provider_cards");
  ok("view answers", Number(n.rows[0].n) > 0, n.rows[0].n);
} catch (e) {
  ok("UNEXPECTED ERROR", false, e.message);
} finally {
  await c.end();
}
for (const r of results) console.log((r.pass ? "PASS " : "FAIL ") + r.name + (r.pass ? "" : "  -> " + r.extra));
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
process.exit(results.every((r) => r.pass) ? 0 : 1);
