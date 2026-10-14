// Dry run of migration 0262 inside ONE rolled-back transaction.   node scripts/check-migration-0262.mjs
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
const sql = readFileSync("supabase/migrations/0262_default_watchlist.sql", "utf8").replace(/^begin;\s*$/m, "-- begin").replace(/^commit;\s*$/m, "-- commit");
const results = [];
const ok = (name, pass, extra = "") => results.push({ name, pass, extra: String(extra) });
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
await c.query("begin");
try {
  const before = Number((await c.query("select count(*) n from market_watchlist")).rows[0].n);
  await c.query(sql);
  const same = Number((await c.query("select count(*) n from market_watchlist")).rows[0].n);
  ok("existing customers keep their watchlist (nothing added by the migration)", same === before, `${before} -> ${same}`);

  // a brand-new sign-up: the auth trigger creates the profile, the new trigger seeds the list
  const id = randomUUID();
  await c.query(
    "insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values ($1, 'authenticated', 'authenticated', $2, '{}'::jsonb, $3::jsonb, now(), now())",
    [id, `dry-run-${id.slice(0, 8)}@example.invalid`, JSON.stringify({ display_name: "Dry run", account_type: "demo" })],
  );
  const prof = Number((await c.query("select count(*) n from profiles where id = $1", [id])).rows[0].n);
  ok("the sign-up created a profile", prof === 1, prof);
  const list = (await c.query("select symbol from market_watchlist where user_id = $1 order by symbol", [id])).rows.map((r) => r.symbol);
  ok("a new customer gets exactly the six default instruments", JSON.stringify(list) === JSON.stringify(["BNBUSDT", "BTCUSDT", "ETHUSDT", "EURUSD", "SOLUSDT", "XAUUSD"]), list.join(","));
  await c.query("delete from market_watchlist where user_id = $1 and symbol = 'BNBUSDT'", [id]);
  const after = Number((await c.query("select count(*) n from market_watchlist where user_id = $1", [id])).rows[0].n);
  ok("the customer can remove one", after === 5, after);
} catch (e) {
  ok("UNEXPECTED ERROR", false, e.message);
} finally {
  await c.query("rollback");
  const still = (await c.query("select count(*) n from pg_proc where proname = 'seed_default_watchlist'")).rows[0].n;
  ok("rolled back: nothing committed", still === "0", still);
  await c.end();
}
for (const r of results) console.log((r.pass ? "PASS " : "FAIL ") + r.name + (r.pass ? "" : "  -> " + r.extra));
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
process.exit(results.every((r) => r.pass) ? 0 : 1);
