// Rebuilt trades against the real market, without the network: a fixed sample of history trades
// (three per symbol) and the real 1-minute candles they were built from are recorded once in
// tests/fixtures/leader-candles.json by scripts/sim/record-candle-fixture.mjs (Binance klines --
// PAXGUSDT for XAUUSD, EURUSDT for EURUSD -- and Dukascopy, hourly for GBPUSD / USDJPY).
// This test reads those trades from the database (SUPABASE_DB_URL), checks they are still the
// recorded ones, and checks each entry / exit against its recorded candle (rules in
// scripts/sim/verify-candles.mjs). It used to download the candles on every run for random trades,
// which made it slow and dependent on the providers' throttling. Run: npm run test:db
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import pg from "pg";
import { config } from "dotenv";
import { HISTORY_VERSION } from "../scripts/sim/rebuild.mjs";
import { candlesOf, checkTrade } from "../scripts/sim/verify-candles.mjs";

config({ path: ".env.local", quiet: true });
const fixture = JSON.parse(readFileSync(new URL("./fixtures/leader-candles.json", import.meta.url), "utf8"));
const REFRESH = "re-record the fixture: node scripts/sim/record-candle-fixture.mjs";
const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
let rows = new Map();

before(async () => {
  await db.connect();
  const { rows: found } = await db.query(
    `select g.id, g.symbol, g.side, g.entry_price::text, g.exit_price::text, g.stop_loss::text, g.take_profit::text, g.opened_at, g.closed_at
     from public.signals g join public.sim_history_builds b on b.provider_id = g.provider_id
     where g.id = any($1::uuid[]) and b.version = $2 and g.status = 'closed' and not g.hidden`,
    [fixture.trades.map((t) => t.id), HISTORY_VERSION],
  );
  rows = new Map(found.map((r) => [r.id, r]));
});

after(() => db.end());

const candle = async (sym, ms) => {
  const c = fixture.candles[`${sym}:${ms}`];
  assert.ok(c, `no recorded candle ${sym} ${new Date(ms).toISOString()} (${REFRESH})`);
  return c;
};

test("the recorded sample matches the current history", () => {
  assert.equal(fixture.historyVersion, HISTORY_VERSION, `the history was rebuilt (version ${HISTORY_VERSION}); ${REFRESH}`);
  assert.ok(fixture.trades.length >= 3, "sampled trades exist");
  assert.ok(new Set(fixture.trades.map((t) => t.symbol)).size >= 3, "several symbols are sampled");
  for (const t of fixture.trades) {
    const r = rows.get(t.id);
    assert.ok(r, `trade ${t.id} (${t.symbol}) is no longer in the history; ${REFRESH}`);
    for (const k of ["symbol", "side", "entry_price", "exit_price", "stop_loss", "take_profit"]) assert.equal(String(r[k]), String(t[k]), `${t.id} ${k}`);
    assert.equal(r.opened_at.toISOString(), t.opened_at, `${t.id} opened_at`);
    assert.equal(r.closed_at.toISOString(), t.closed_at, `${t.id} closed_at`);
    for (const ms of candlesOf(t)) assert.ok(fixture.candles[`${t.symbol}:${ms}`], `${t.id}: candle recorded`);
  }
});

test("entry and exit prices are the real 1-minute candles", async () => {
  // The database values, checked against the candles recorded from the sources.
  for (const t of fixture.trades) {
    const r = rows.get(t.id);
    assert.ok(r, `trade ${t.id} missing; ${REFRESH}`);
    await checkTrade(r, candle);
  }
});
