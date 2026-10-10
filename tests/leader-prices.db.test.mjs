// Rebuilt trades against the real market: for a sample of each symbol's trades
// (SUPABASE_DB_URL), the 1-minute candle is fetched again from the source the
// history was built from (Binance klines -- PAXGUSDT for XAUUSD, EURUSDT for
// EURUSD -- and Dukascopy for GBPUSD / USDJPY) and
//   - the entry is that minute's opening price plus / minus half the spread;
//   - a stop / target exit (closed 30 s into a minute) is a level that minute's
//     range reached on the exit side of the spread;
//   - a market exit (closed on the minute) is that minute's open minus / plus
//     half the spread.
// GBPUSD / USDJPY are rebuilt from hourly candles, so their candle is the hour.
// Needs network access. Run: npm run test:db
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { config } from "dotenv";
import { FEEDS, DP, MINUTE, decodeDukascopyDay, getWithRetry } from "../scripts/sim/candles.mjs";
import { halfSpread } from "../scripts/sim/engine.mjs";
import { HISTORY_VERSION } from "../scripts/sim/rebuild.mjs";

config({ path: ".env.local", quiet: true });
const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
let trades = [];

before(async () => {
  await db.connect();
  // Three random closed trades per symbol of the rebuilt leaders.
  trades = (
    await db.query(
      `select * from (
         select g.symbol, g.side, g.entry_price, g.exit_price, g.stop_loss, g.take_profit, g.opened_at, g.closed_at,
                row_number() over (partition by g.symbol order by random()) rn
         from public.signals g join public.sim_history_builds b on b.provider_id = g.provider_id
         -- History trades only; live ones are checked against the live feed (leader-history test).
         where b.version = $1 and g.status = 'closed' and not g.hidden and g.closed_at <= b.history_to) x
       where rn <= 3`,
      [HISTORY_VERSION],
    )
  ).rows;
});

after(() => db.end());

// The loader's own downloader: patient with Dukascopy's throttling.
const get = getWithRetry;

// The real candle starting at `ms` (1 minute; 1 hour for the hourly symbols), as integer prices.
const dayCache = new Map();
async function candle(sym, ms) {
  const feed = FEEDS[sym];
  const scale = 10 ** DP[sym];
  if (feed.src === "binance") {
    const [k] = await get(`https://data-api.binance.vision/api/v3/klines?symbol=${feed.pair}&interval=1m&startTime=${ms}&limit=1`, true);
    assert.equal(k[0], ms, `${sym} candle at ${new Date(ms).toISOString()}`);
    return { o: Math.round(+k[1] * scale), h: Math.round(+k[2] * scale), l: Math.round(+k[3] * scale) };
  }
  const conv = scale / feed.point;
  if (feed.hourly) {
    // The hour's candle: the month file of hourly candles, or (current month)
    // that day's minutes folded into the hour, like candles.mjs builds it.
    const d = new Date(ms);
    const monthStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    const finished = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) <= Date.now() - 86400000;
    const base = `https://datafeed.dukascopy.com/datafeed/${feed.inst}/${d.getUTCFullYear()}/${String(d.getUTCMonth()).padStart(2, "0")}`;
    const key = `${sym}:h:${finished ? monthStart : Math.floor(ms / 86400000)}`;
    if (!dayCache.has(key)) {
      if (finished) dayCache.set(key, decodeDukascopyDay(await get(`${base}/BID_candles_hour_1.bi5`, false)).map((r) => ({ ...r, at: monthStart + r.sec * 1000 })));
      else {
        const day = Math.floor(ms / 86400000) * 86400000;
        const rows = decodeDukascopyDay(await get(`${base}/${String(d.getUTCDate()).padStart(2, "0")}/BID_candles_min_1.bi5`, false)).filter((r) => r.vol > 0);
        const hours = new Map();
        for (const r of rows) {
          const at = day + Math.floor(r.sec / 3600) * 3600000;
          const x = hours.get(at);
          if (!x) hours.set(at, { at, o: r.o, h: r.h, l: r.l, c: r.c, vol: r.vol });
          else Object.assign(x, { h: Math.max(x.h, r.h), l: Math.min(x.l, r.l), c: r.c });
        }
        dayCache.set(key, [...hours.values()]);
      }
    }
    const row = dayCache.get(key).find((r) => r.at === ms);
    assert.ok(row && row.vol > 0, `${sym} traded hour at ${new Date(ms).toISOString()}`);
    return { o: Math.round(row.o * conv), h: Math.round(row.h * conv), l: Math.round(row.l * conv) };
  }
  const day = Math.floor(ms / 86400000) * 86400000;
  const key = `${sym}:${day}`;
  if (!dayCache.has(key)) {
    const d = new Date(day);
    const url = `https://datafeed.dukascopy.com/datafeed/${feed.inst}/${d.getUTCFullYear()}/${String(d.getUTCMonth()).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}/BID_candles_min_1.bi5`;
    dayCache.set(key, decodeDukascopyDay(await get(url, false)));
  }
  const row = dayCache.get(key).find((r) => day + r.sec * 1000 === ms);
  assert.ok(row && row.vol > 0, `${sym} traded minute at ${new Date(ms).toISOString()}`);
  return { o: Math.round(row.o * conv), h: Math.round(row.h * conv), l: Math.round(row.l * conv) };
}

test("sampled trades exist", () => {
  assert.ok(trades.length >= 3, "run scripts/sim/rebuild.mjs --apply first");
});

test("entry and exit prices are the real 1-minute candles", async () => {
  for (const t of trades) {
    const scale = 10 ** DP[t.symbol];
    const int = (v) => Math.round(Number(v) * scale);
    const dir = t.side === "sell" ? -1 : 1;
    const label = `${t.symbol} ${t.side} ${t.opened_at.toISOString()}`;

    const openMs = t.opened_at.getTime();
    assert.equal(openMs % (FEEDS[t.symbol].hourly ? 60 * MINUTE : MINUTE), 0, `${label}: opens on a minute (on the hour for hourly symbols)`);
    const c0 = await candle(t.symbol, openMs);
    assert.equal(int(t.entry_price), c0.o + dir * halfSpread(t.symbol, c0.o), `${label}: entry = open +/- half spread`);

    const closeMs = t.closed_at.getTime();
    const step = FEEDS[t.symbol].hourly ? 60 * MINUTE : MINUTE;
    const minute = Math.floor(closeMs / step) * step;
    const c1 = await candle(t.symbol, minute);
    const half = halfSpread(t.symbol, c0.o);
    const exit = int(t.exit_price);
    if (closeMs - minute === 30_000) {
      const sl = int(t.stop_loss);
      const tp = int(t.take_profit);
      const adverse = (dir > 0 ? c1.l : c1.h) - dir * half;
      const favour = (dir > 0 ? c1.h : c1.l) - dir * half;
      if (exit === sl) assert.ok((adverse - sl) * dir <= 0, `${label}: the stop was reached`);
      else {
        assert.equal(exit, tp, `${label}: a level exit is the stop or the target`);
        assert.ok((favour - tp) * dir >= 0, `${label}: the target was reached`);
      }
    } else {
      assert.equal(closeMs, minute, `${label}: a market exit is on the minute`);
      assert.equal(exit, c1.o - dir * half, `${label}: market exit = open -/+ half spread`);
    }
  }
});
