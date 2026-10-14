// Dry run of migration 0261 inside ONE rolled-back transaction.   node scripts/check-migration-0261.mjs
import { readFileSync } from "node:fs";
import pg from "pg";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
const sql = readFileSync("supabase/migrations/0261_more_crypto.sql", "utf8").replace(/^begin;\s*$/m, "-- begin").replace(/^commit;\s*$/m, "-- commit");
const results = [];
const ok = (name, pass, extra = "") => results.push({ name, pass, extra: String(extra) });
const COINS = "BTC ETH BNB SOL XRP ADA DOGE TRX AVAX LINK DOT LTC NEAR SUI UNI BCH ATOM XLM TON SHIB".split(" ");
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
await c.query("begin");
try {
  await c.query(sql);

  // 1. the URL the database will call really answers for every symbol
  const def = (await c.query("select pg_get_functiondef('public.fire_price_fetch_requests()'::regprocedure) d")).rows[0].d;
  const url = def.match(/url := '(https:\/\/api\.binance\.com[^']+)'/)?.[1];
  ok("the fetch function calls the Binance ticker with the new list", !!url && COINS.every((s) => url.includes(`${s}USDT`)));
  const res = await fetch(url);
  const body = await res.json();
  ok("Binance answers 200 with 22 prices", res.status === 200 && Array.isArray(body) && body.length === 22, `${res.status} ${body.length}`);
  ok("every price is a positive number", body.every((r) => Number(r.price) > 0));

  // 2. the apply step writes all of them (a fake answer is placed where pg_net would put the real one)
  await c.query("delete from market_prices where symbol = any($1)", [COINS.filter((s) => !["BTC", "ETH", "BNB", "SOL", "XRP"].includes(s)).map((s) => `${s}USDT`)]);
  await c.query("update _price_fetch_state set request_id = 987654321 where source = 'crypto'");
  await c.query("insert into net._http_response (id, status_code, content_type, headers, content, timed_out, error_msg, created) values (987654321, 200, 'application/json', '{}'::jsonb, $1, false, null, now())", [JSON.stringify(body)]);
  await c.query("select apply_price_fetch_responses()");
  const have = (await c.query("select symbol from market_prices where symbol = any($1)", [COINS.map((s) => `${s}USDT`)])).rows.map((r) => r.symbol);
  ok("apply wrote all 20 coins to market_prices", have.length === 20, have.length);
  const hist = Number((await c.query("select count(distinct symbol) n from price_history where ts > now() - interval '1 minute' and symbol = any($1)", [COINS.map((s) => `${s}USDT`)])).rows[0].n);
  ok("and to price_history", hist === 20, hist);

  // 3. the snapshot
  const snap = (await c.query("select * from market_snapshot()")).rows;
  ok("snapshot has updated_at and source_date columns", snap.length >= 20 && "updated_at" in snap[0] && "source_date" in snap[0], snap.length);
  ok("a new coin has a price in the snapshot", snap.some((r) => r.symbol === "DOGEUSDT" && Number(r.price) > 0));
  await c.query("set local role authenticated");
  const authd = (await c.query("select count(*) n from market_snapshot()")).rows[0].n;
  ok("customers can still read the snapshot", Number(authd) >= 20, authd);
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
  ok("visitors still cannot", denied);
  await c.query("reset role");
} catch (e) {
  ok("UNEXPECTED ERROR", false, e.message);
} finally {
  await c.query("rollback");
  const def = (await c.query("select pg_get_functiondef('public.fire_price_fetch_requests()'::regprocedure) d")).rows[0].d;
  ok("rolled back: the fetch function is unchanged", !def.includes("ADAUSDT"));
  await c.end();
}
for (const r of results) console.log((r.pass ? "PASS " : "FAIL ") + r.name + (r.pass ? "" : "  -> " + r.extra));
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
process.exit(results.every((r) => r.pass) ? 0 : 1);
