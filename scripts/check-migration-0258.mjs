// Dry run of migration 0258 inside ONE rolled-back transaction.   node scripts/check-migration-0258.mjs
import { readFileSync } from "node:fs";
import pg from "pg";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
const sql = readFileSync("supabase/migrations/0258_leader_privacy.sql", "utf8").replace(/^begin;\s*$/m, "-- begin").replace(/^commit;\s*$/m, "-- commit");
const results = [];
const ok = (name, pass, extra = "") => results.push({ name, pass, extra: String(extra) });
const PRIVATE = ["total_profit", "total_withdrawals", "account_capital", "total_deposits", "pnl_7d", "pnl_30d", "pnl_90d", "pnl_180d", "pnl_all", "aum"];
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
await c.query("begin");
try {
  const cols = async () => (await c.query("select column_name from information_schema.columns where table_schema='public' and table_name='provider_cards'")).rows.map((r) => r.column_name);
  const before = await cols();
  const rowsBefore = Number((await c.query("select count(*) n from provider_cards")).rows[0].n);
  ok("before: private columns exist", PRIVATE.every((p) => before.includes(p)));

  await c.query(sql);
  const after = await cols();
  ok("view: no private column is left", PRIVATE.every((p) => !after.includes(p)), PRIVATE.filter((p) => after.includes(p)).join(","));
  ok("view: aum_band exists", after.includes("aum_band"));
  ok("view: every other column is kept", before.filter((b) => !PRIVATE.includes(b)).every((b) => after.includes(b)), before.filter((b) => !PRIVATE.includes(b) && !after.includes(b)).join(","));
  const rowsAfter = Number((await c.query("select count(*) n from provider_cards")).rows[0].n);
  ok(`view: same leaders (${rowsBefore})`, rowsAfter === rowsBefore, `${rowsAfter}`);
  const bands = (await c.query("select aum_band b, count(*) n from provider_cards group by 1 order by 1")).rows;
  ok("view: bands are 0..6", bands.every((r) => r.b == null || (r.b >= 0 && r.b <= 6)), JSON.stringify(bands));

  await c.query("set local role authenticated");
  await c.query("savepoint s1");
  let denied = false;
  try { await c.query("select total_profit from public.providers limit 1"); } catch (e) { denied = /permission denied/i.test(e.message); }
  await c.query("rollback to savepoint s1");
  ok("authenticated cannot read providers.total_profit", denied);
  for (const col of ["total_withdrawals", "account_capital"]) {
    await c.query("savepoint s2");
    let d = false;
    try { await c.query(`select ${col} from public.providers limit 1`); } catch (e) { d = /permission denied/i.test(e.message); }
    await c.query("rollback to savepoint s2");
    ok(`authenticated cannot read providers.${col}`, d);
  }
  const names = await c.query("select display_name from public.providers limit 1");
  ok("authenticated still reads providers.display_name", names.rows.length === 1);
  await c.query("reset role");
  await c.query("set local role anon");
  const anon = await c.query("select count(*) n from provider_cards");
  ok("a visitor still reads provider_cards", Number(anon.rows[0].n) === rowsBefore);
  await c.query("reset role");

  const fns = (await c.query("select proname, prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and prosrc ilike '%provider_cards%'")).rows;
  const bad = fns.filter((f) => PRIVATE.some((p) => new RegExp(`\b(pc|c|cards?)\.${p}\b|provider_cards[^;]{0,400}\b${p}\b`, "i").test(f.prosrc)));
  ok(`functions reading provider_cards (${fns.length}) do not use a removed column`, bad.length === 0, bad.map((f) => f.proname).join(","));
} catch (e) {
  ok("UNEXPECTED ERROR", false, e.message);
} finally {
  await c.query("rollback");
  const after = (await c.query("select column_name from information_schema.columns where table_schema='public' and table_name='provider_cards'")).rows.map((r) => r.column_name);
  ok("rolled back: view unchanged", after.includes("total_profit") && !after.includes("aum_band"));
  await c.end();
}
for (const r of results) console.log((r.pass ? "PASS " : "FAIL ") + r.name + (r.pass ? "" : "  -> " + r.extra));
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
process.exit(results.every((r) => r.pass) ? 0 : 1);
