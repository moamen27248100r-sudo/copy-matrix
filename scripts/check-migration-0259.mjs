// Dry run of migration 0259 inside ONE rolled-back transaction.   node scripts/check-migration-0259.mjs
import { readFileSync } from "node:fs";
import pg from "pg";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
const sql = readFileSync("supabase/migrations/0259_markets.sql", "utf8").replace(/^begin;\s*$/m, "-- begin").replace(/^commit;\s*$/m, "-- commit");
const results = [];
const ok = (name, pass, extra = "") => results.push({ name, pass, extra: String(extra) });
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
await c.query("begin");
try {
  await c.query(sql);
  const t0 = Date.now();
  const snap = (await c.query("select * from market_snapshot()")).rows;
  ok(`snapshot answers for every instrument in ${Date.now() - t0}ms`, snap.length === 9 && snap.every((r) => r.price != null && r.change_pct != null), snap.length);
  ok("snapshot: high >= low", snap.every((r) => Number(r.high_24h) >= Number(r.low_24h)));
  ok("snapshot: sparkline has points", snap.every((r) => Array.isArray(r.spark) && r.spark.length >= 12), snap.map((r) => r.spark?.length).join(","));
  const ser = (await c.query("select * from market_series('BTCUSDT', 24)")).rows;
  ok("series: a day of BTC has 100+ points", ser.length >= 100, ser.length);
  const ser7 = (await c.query("select * from market_series('XAUUSD', 168)")).rows;
  ok("series: a week of gold has 100+ points", ser7.length >= 100, ser7.length);
  const lead = (await c.query("select * from top_leaders_for_symbol('XAUUSD', 5)")).rows;
  ok("top leaders for gold", lead.length > 0, lead.length);

  const u = (await c.query("select id from profiles where email = 'mo48100r@gmail.com'")).rows[0]?.id;
  if (!u) throw new Error("fixture: test user missing");
  await c.query("delete from notifications where user_id = $1 and type = 'market_move'", [u]);
  await c.query("delete from notification_preferences where user_id = $1", [u]);
  for (const s of ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT"])
    await c.query("insert into market_watchlist (user_id, symbol) values ($1, $2)", [u, s]);
  // for the check every instrument counts as a big mover
  await c.query("create or replace function public.market_move_threshold(p_symbol text) returns numeric language sql immutable as $f$ select 0.0::numeric $f$");
  const first = (await c.query("select generate_market_alerts() n")).rows[0].n;
  const got = Number((await c.query("select count(*) n from notifications where user_id = $1 and type = 'market_move'", [u])).rows[0].n);
  ok("a customer gets at most 3 market notices a day", got <= 3 && got >= 1, `inserted=${first} delivered=${got}`);
  const second = (await c.query("select generate_market_alerts() n")).rows[0].n;
  const got2 = Number((await c.query("select count(*) n from notifications where user_id = $1 and type = 'market_move'", [u])).rows[0].n);
  ok("running again adds nothing (no repeat, still max 3)", got2 === got && Number(second) === 0, `second=${second} total=${got2}`);
  const cats = (await c.query("select notification_category('market_move') a, notification_category('copy_closed') b, notification_category('wallet_deposit_approved') d")).rows[0];
  ok("categories", cats.a === "market" && cats.b === "copy_trades" && cats.d === "account", JSON.stringify(cats));

  await c.query("delete from notifications where user_id = $1 and type = 'market_move'", [u]);
  await c.query("delete from market_alert_log where user_id = $1", [u]);
  await c.query("insert into notification_preferences (user_id, category, in_app, email) values ($1, 'market', false, false)", [u]);
  await c.query("select generate_market_alerts()");
  const off = Number((await c.query("select count(*) n from notifications where user_id = $1 and type = 'market_move'", [u])).rows[0].n);
  ok("market notices switched off are not delivered", off === 0, off);

  await c.query("set local role authenticated");
  await c.query("select set_config('request.jwt.claims', json_build_object('sub', $1::text, 'role', 'authenticated')::text, true)", [u]);
  const wl = (await c.query("select count(*) n from market_watchlist")).rows[0].n;
  ok("a customer reads only own watchlist rows", Number(wl) === 9, wl);
  await c.query("reset role");
  await c.query("set local role anon");
  await c.query("savepoint s");
  let denied = false;
  try {
    await c.query("select * from market_snapshot()");
  } catch (e) {
    denied = /permission denied/i.test(e.message);
  }
  await c.query("rollback to savepoint s");
  ok("a visitor cannot call market_snapshot", denied);
  await c.query("reset role");
} catch (e) {
  ok("UNEXPECTED ERROR", false, e.message);
} finally {
  await c.query("rollback");
  const still = (await c.query("select count(*) n from pg_proc where proname = 'market_snapshot'")).rows[0].n;
  ok("rolled back: nothing committed", still === "0", still);
  await c.end();
}
for (const r of results) console.log((r.pass ? "PASS " : "FAIL ") + r.name + (r.pass ? "" : "  -> " + r.extra));
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
process.exit(results.every((r) => r.pass) ? 0 : 1);
