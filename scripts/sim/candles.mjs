// Hourly price history used to rebuild the simulated leaders' track records.
//
// Crypto, gold (PAXG) and EURUSD (EURUSDT) come from Binance 1h klines; GBPUSD
// and USDJPY only exist as daily reference rates (Frankfurter), so their hours
// are bridged between real daily closes -- the simulator only lets multi-day
// (swing / position) personas trade those two.
//
// Downloads are cached as JSON in CANDLE_DIR (default: <tmp>/copy-matrix-candles)
// so a rebuild is reproducible offline once fetched.

import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mulberry32, hashSeed } from "./rng.mjs";

export const HOUR = 3600_000;
export const CANDLE_DIR = process.env.CANDLE_DIR || join(tmpdir(), "copy-matrix-candles");

const BINANCE = {
  BTCUSDT: "BTCUSDT",
  ETHUSDT: "ETHUSDT",
  SOLUSDT: "SOLUSDT",
  BNBUSDT: "BNBUSDT",
  XRPUSDT: "XRPUSDT",
  XAUUSD: "PAXGUSDT",
  EURUSD: "EURUSDT",
};
const DAILY_FX = { GBPUSD: "GBP", USDJPY: "JPY" };

export const SYMBOLS = [...Object.keys(BINANCE), ...Object.keys(DAILY_FX)];

async function getJson(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return await res.json();
    } catch (err) {
      if (attempt >= 5) throw err;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

async function fetchBinance(pair, fromMs, toMs) {
  const out = [];
  let start = fromMs;
  while (start < toMs) {
    const rows = await getJson(
      `https://data-api.binance.vision/api/v3/klines?symbol=${pair}&interval=1h&startTime=${start}&endTime=${toMs}&limit=1000`,
    );
    if (!rows.length) break;
    for (const r of rows) out.push([r[0], +r[1], +r[2], +r[3], +r[4]]);
    start = rows[rows.length - 1][0] + HOUR;
  }
  return out;
}

async function fetchDailyFx(code, fromMs, toMs) {
  const d = (ms) => new Date(ms).toISOString().slice(0, 10);
  const out = [];
  // Frankfurter caps a range response, so walk it a year at a time.
  for (let a = fromMs; a < toMs; a += 365 * 24 * HOUR) {
    const b = Math.min(toMs, a + 365 * 24 * HOUR);
    const body = await getJson(`https://api.frankfurter.dev/v1/${d(a)}..${d(b)}?base=USD&symbols=${code}`);
    for (const [day, rates] of Object.entries(body.rates)) out.push([Date.parse(day + "T16:00:00Z"), rates[code]]);
  }
  const seen = new Set();
  return out.filter(([t]) => (seen.has(t) ? false : seen.add(t))).sort((x, y) => x[0] - y[0]);
}

// Hourly OHLC bridged between real daily closes (GBPUSD = 1/rate).
function bridgeDaily(symbol, daily, fromMs, toMs) {
  const closes = daily.map(([t, r]) => [t, symbol === "GBPUSD" ? 1 / r : r]);
  const rets = [];
  for (let i = 1; i < closes.length; i++) rets.push(Math.log(closes[i][1] / closes[i - 1][1]));
  const sdDaily = Math.sqrt(rets.reduce((a, b) => a + b * b, 0) / Math.max(1, rets.length));
  const rnd = mulberry32(hashSeed(`bridge:${symbol}`));
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() || 1e-12)) * Math.cos(2 * Math.PI * rnd());
  const out = [];
  for (let i = 1; i < closes.length; i++) {
    const [t0, c0] = closes[i - 1];
    const [t1, c1] = closes[i];
    const n = Math.round((t1 - t0) / HOUR);
    const sdHour = sdDaily / Math.sqrt(24);
    const walk = [0];
    for (let k = 1; k <= n; k++) walk.push(walk[k - 1] + gauss() * sdHour);
    for (let k = 0; k < n; k++) {
      const f = k / n;
      const p = Math.log(c0) + (Math.log(c1) - Math.log(c0)) * f + walk[k] - walk[n] * f;
      const q = Math.log(c0) + (Math.log(c1) - Math.log(c0)) * ((k + 1) / n) + walk[k + 1] - walk[n] * ((k + 1) / n);
      const o = Math.exp(p);
      const c = Math.exp(q);
      const wick = Math.abs(gauss()) * sdHour * 0.35;
      out.push([t0 + k * HOUR, o, Math.max(o, c) * Math.exp(wick), Math.min(o, c) * Math.exp(-wick), c]);
    }
  }
  return out.filter(([t]) => t >= fromMs && t < toMs);
}

export async function ensureCandles(fromMs, toMs, { log = () => {} } = {}) {
  mkdirSync(CANDLE_DIR, { recursive: true });
  const result = {};
  for (const symbol of SYMBOLS) {
    const file = join(CANDLE_DIR, `${symbol}.json`);
    let rows = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
    const covers = rows && rows.length && rows[0][0] <= fromMs && rows[rows.length - 1][0] >= toMs - 3 * HOUR;
    if (!covers) {
      log(`fetching ${symbol}...`);
      if (BINANCE[symbol]) rows = await fetchBinance(BINANCE[symbol], fromMs, toMs);
      else rows = bridgeDaily(symbol, await fetchDailyFx(DAILY_FX[symbol], fromMs - 10 * 24 * HOUR, toMs), fromMs, toMs);
      writeFileSync(file, JSON.stringify(rows));
    }
    result[symbol] = rows;
  }
  return result;
}

// Dense hourly series (gaps forward-filled) indexed from `fromMs`.
export class HourlySeries {
  constructor(rows, fromMs, toMs) {
    this.from = fromMs;
    const n = Math.ceil((toMs - fromMs) / HOUR);
    this.o = new Float64Array(n);
    this.h = new Float64Array(n);
    this.l = new Float64Array(n);
    this.c = new Float64Array(n);
    let j = 0;
    let last = rows[0];
    for (let i = 0; i < n; i++) {
      const t = fromMs + i * HOUR;
      while (j < rows.length && rows[j][0] <= t) last = rows[j++];
      if (last[0] === t) {
        this.o[i] = last[1];
        this.h[i] = last[2];
        this.l[i] = last[3];
        this.c[i] = last[4];
      } else {
        this.o[i] = this.h[i] = this.l[i] = this.c[i] = last[4];
      }
    }
    this.n = n;
  }
  index(ms) {
    return Math.floor((ms - this.from) / HOUR);
  }
}
