// Records the fixture of tests/leader-prices.db.test.mjs: three closed history trades per symbol
// (picked at random once, here) and the real 1-minute (hourly for GBPUSD / USDJPY) candles they
// were built from, downloaded from the original sources. Each trade is checked against its candles
// before it is written, so the fixture only holds trades that pass.
// Run after scripts/sim/rebuild.mjs --apply (the test fails with a pointer here when the history
// changed):   node scripts/sim/record-candle-fixture.mjs
import { writeFileSync } from "node:fs";
import pg from "pg";
import { config } from "dotenv";
import { HISTORY_VERSION } from "./rebuild.mjs";
import { candleFromSource, candlesOf, checkTrade } from "./verify-candles.mjs";

config({ path: ".env.local", quiet: true });
const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await db.connect();
const rows = (
  await db.query(
    `select * from (
       select g.id, g.symbol, g.side, g.entry_price::text, g.exit_price::text, g.stop_loss::text, g.take_profit::text, g.opened_at, g.closed_at,
              row_number() over (partition by g.symbol order by random()) rn
       from public.signals g join public.sim_history_builds b on b.provider_id = g.provider_id
       where b.version = $1 and g.status = 'closed' and not g.hidden and g.closed_at <= b.history_to) x
     where rn <= 3 order by symbol, opened_at`,
    [HISTORY_VERSION],
  )
).rows;
await db.end();

const candles = {};
const recordingCandle = async (sym, ms) => {
  const c = await candleFromSource(sym, ms);
  candles[`${sym}:${ms}`] = c;
  return c;
};
const trades = [];
for (const r of rows) {
  const t = { id: r.id, symbol: r.symbol, side: r.side, entry_price: r.entry_price, exit_price: r.exit_price, stop_loss: r.stop_loss, take_profit: r.take_profit, opened_at: r.opened_at.toISOString(), closed_at: r.closed_at.toISOString() };
  await checkTrade(t, recordingCandle);
  for (const ms of candlesOf(t)) if (!candles[`${t.symbol}:${ms}`]) throw new Error(`missing candle ${t.symbol} ${ms}`);
  trades.push(t);
  process.stdout.write(".");
}
const fixture = {
  note: "Real market candles (Binance klines, Dukascopy) recorded by scripts/sim/record-candle-fixture.mjs; integer prices at the symbol's decimals.",
  historyVersion: HISTORY_VERSION,
  recordedAt: new Date().toISOString(),
  trades,
  candles,
};
writeFileSync("tests/fixtures/leader-candles.json", JSON.stringify(fixture, null, 1) + "\n");
console.log(`\n${trades.length} trades, ${Object.keys(candles).length} candles -> tests/fixtures/leader-candles.json`);
