// How a rebuilt trade is checked against the real market, shared by the recorder
// (scripts/sim/record-candle-fixture.mjs, which downloads the candles once) and the test
// (tests/leader-prices.db.test.mjs, which reads them from the recorded fixture, no network):
//   - the entry is the opening price of the entry minute plus / minus half the spread;
//   - a stop / target exit (closed 30 s into a minute) is a level that minute's range reached on
//     the exit side of the spread;
//   - a market exit (closed on the minute) is that minute's open minus / plus half the spread.
// GBPUSD / USDJPY are rebuilt from hourly candles, so their candle is the hour.
import assert from "node:assert/strict";
import { FEEDS, DP, MINUTE, decodeDukascopyDay, getWithRetry } from "./candles.mjs";
import { halfSpread } from "./engine.mjs";

/** The candles a trade needs: [symbol, start ms] of its entry and exit candle. */
export function candlesOf(t) {
  const step = FEEDS[t.symbol].hourly ? 60 * MINUTE : MINUTE;
  const openMs = new Date(t.opened_at).getTime();
  const closeMs = new Date(t.closed_at).getTime();
  return [openMs, Math.floor(closeMs / step) * step];
}

/** Checks one trade with a candle lookup (sym, ms) -> { o, h, l } in integer prices. */
export async function checkTrade(t, candle) {
  const scale = 10 ** DP[t.symbol];
  const int = (v) => Math.round(Number(v) * scale);
  const dir = t.side === "sell" ? -1 : 1;
  const openMs = new Date(t.opened_at).getTime();
  const closeMs = new Date(t.closed_at).getTime();
  const label = `${t.symbol} ${t.side} ${new Date(openMs).toISOString()}`;
  const step = FEEDS[t.symbol].hourly ? 60 * MINUTE : MINUTE;

  assert.equal(openMs % step, 0, `${label}: opens on a minute (on the hour for hourly symbols)`);
  const c0 = await candle(t.symbol, openMs);
  assert.equal(int(t.entry_price), c0.o + dir * halfSpread(t.symbol, c0.o), `${label}: entry = open +/- half spread`);

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

// The real candle starting at `ms`, downloaded from the source the history was built from
// (Binance klines -- PAXGUSDT for XAUUSD, EURUSDT for EURUSD -- and Dukascopy). Used by the
// recorder only.
const dayCache = new Map();
export async function candleFromSource(sym, ms) {
  const feed = FEEDS[sym];
  const scale = 10 ** DP[sym];
  if (feed.src === "binance") {
    const [k] = await getWithRetry(`https://data-api.binance.vision/api/v3/klines?symbol=${feed.pair}&interval=1m&startTime=${ms}&limit=1`, true);
    assert.equal(k[0], ms, `${sym} candle at ${new Date(ms).toISOString()}`);
    return { o: Math.round(+k[1] * scale), h: Math.round(+k[2] * scale), l: Math.round(+k[3] * scale) };
  }
  const conv = scale / feed.point;
  if (feed.hourly) {
    // The hour's candle: the month file of hourly candles, or (current month) that day's minutes
    // folded into the hour, like candles.mjs builds it.
    const d = new Date(ms);
    const monthStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    const finished = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) <= Date.now() - 86400000;
    const base = `https://datafeed.dukascopy.com/datafeed/${feed.inst}/${d.getUTCFullYear()}/${String(d.getUTCMonth()).padStart(2, "0")}`;
    const key = `${sym}:h:${finished ? monthStart : Math.floor(ms / 86400000)}`;
    if (!dayCache.has(key)) {
      if (finished) dayCache.set(key, decodeDukascopyDay(await getWithRetry(`${base}/BID_candles_hour_1.bi5`, false)).map((r) => ({ ...r, at: monthStart + r.sec * 1000 })));
      else {
        const day = Math.floor(ms / 86400000) * 86400000;
        const rows = decodeDukascopyDay(await getWithRetry(`${base}/${String(d.getUTCDate()).padStart(2, "0")}/BID_candles_min_1.bi5`, false)).filter((r) => r.vol > 0);
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
    dayCache.set(key, decodeDukascopyDay(await getWithRetry(url, false)));
  }
  const row = dayCache.get(key).find((r) => day + r.sec * 1000 === ms);
  assert.ok(row && row.vol > 0, `${sym} traded minute at ${new Date(ms).toISOString()}`);
  return { o: Math.round(row.o * conv), h: Math.round(row.h * conv), l: Math.round(row.l * conv) };
}
