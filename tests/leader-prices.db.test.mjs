// Rebuilt trades against the real market: for a sample of each symbol's trades
// (SUPABASE_DB_URL), the 1-minute candle is fetched again from the source the
// history was built from (Binance klines -- PAXGUSDT for XAUUSD, EURUSDT for
// EURUSD -- and Dukascopy for GBPUSD / USDJPY) and
//   - the entry is that minute's opening price plus / minus half the spread;
//   - a stop / target exit (closed 30 s into a minute) is a level that minute's
//     range reached on the exit side of the spread;
//   - a market exit (closed on the minute) is that minute's open minus / plus
//     half the spread.
// Needs network access. Run: npm run test:db
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { config } from "dotenv";
import { FEEDS, DP, MINUTE, decodeDukascopyDay } from "../scripts/sim/candles.mjs";
import { halfSpread } from "../scripts/sim/engine.mjs";
import { HISTORY_VERSION } from "../scripts/sim/rebuild.mjs";

config({ path: ".env.local", quiet: true });
const db = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
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
         where b.version = $1 and g.status = 'closed' and not g.hidden) x
       where rn <= 3`,
      [HISTORY_VERSION],
    )
  ).rows;
});

after(() => db.end());

async function get(url, json) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } }).catch((e) => ({ ok: false, status: String(e) }));
    if (res.ok) return json ? res.json() : Buffer.from(await res.arrayBuffer());
    if (attempt >= 4) throw new Error(`${res.status} ${url}`);
    await new Promise((r) => setTimeout(r, 1500 * attempt));
  }
}

// The real 1-minute candle starting at `ms`, as integer prices.
const dayCache = new Map();
async function candle(sym, ms) {
  const feed = FEEDS[sym];
  const scale = 10 ** DP[sym];
  if (feed.src === "binance") {
    const [k] = await get(`https://data-api.binance.vision/api/v3/klines?symbol=${feed.pair}&interval=1m&startTime=${ms}&limit=1`, true);
    assert.equal(k[0], ms, `${sym} candle at ${new Date(ms).toISOString()}`);
    return { o: Math.round(+k[1] * scale), h: Math.round(+k[2] * scale), l: Math.round(+k[3] * scale) };
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
  const conv = scale / feed.point;
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
    assert.equal(openMs % MINUTE, 0, `${label}: opens on a minute`);
    const c0 = await candle(t.symbol, openMs);
    assert.equal(int(t.entry_price), c0.o + dir * halfSpread(t.symbol, c0.o), `${label}: entry = open +/- half spread`);

    const closeMs = t.closed_at.getTime();
    const minute = Math.floor(closeMs / MINUTE) * MINUTE;
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
