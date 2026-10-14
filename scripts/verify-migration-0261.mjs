// Read-only verification of migration 0261 on the live database.   node scripts/verify-migration-0261.mjs
import pg from "pg";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
const results = [];
const ok = (name, pass, extra = "") => results.push({ name, pass, extra: String(extra) });
const COINS = "BTC ETH BNB SOL XRP ADA DOGE TRX AVAX LINK DOT LTC NEAR SUI UNI BCH ATOM XLM TON SHIB".split(" ").map((s) => `${s}USDT`);
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
try {
  const def = (await c.query("select pg_get_functiondef('public.fire_price_fetch_requests()'::regprocedure) d")).rows[0].d;
  ok("fetch function lists the 20 coins", COINS.every((s) => def.includes(s)));
  const cols = (await c.query("select column_name from information_schema.columns where table_name = 'market_prices'")).rows.map((r) => r.column_name);
  ok("market_prices unchanged shape", cols.includes("updated_at") && cols.includes("source_date"));
  const g = await c.query("select has_function_privilege('authenticated', 'public.market_snapshot()', 'execute') a, has_function_privilege('anon', 'public.market_snapshot()', 'execute') n");
  ok("snapshot: customers yes, visitors no", g.rows[0].a === true && g.rows[0].n === false);
  const snap = (await c.query("select * from market_snapshot()")).rows;
  ok("snapshot has the new columns", snap.length > 0 && "updated_at" in snap[0] && "source_date" in snap[0]);
  // the new coins appear once the next fetch has run (every 10 seconds)
  const fresh = (await c.query("select symbol from market_prices where symbol = any($1) and updated_at > now() - interval '5 minutes'", [COINS])).rows;
  ok(`new coins have a fresh live price (${fresh.length}/20)`, fresh.length === 20, fresh.length);
} catch (e) {
  ok("UNEXPECTED ERROR", false, e.message);
} finally {
  await c.end();
}
for (const r of results) console.log((r.pass ? "PASS " : "FAIL ") + r.name + (r.pass ? "" : "  -> " + r.extra));
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
process.exit(results.every((r) => r.pass) ? 0 : 1);
