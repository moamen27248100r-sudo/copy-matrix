// Real 1-minute price history used to rebuild the simulated leaders' track
// records. Every symbol comes from the same market the platform's live feed
// (public.fire_price_fetch_requests) quotes, so a rebuilt history joins the
// live trades without a jump:
//
//   BTCUSDT ETHUSDT SOLUSDT BNBUSDT XRPUSDT  Binance spot 1m klines
//   XAUUSD                                   Binance PAXGUSDT 1m klines (gold-backed token)
//   EURUSD                                   Binance EURUSDT 1m klines
//   GBPUSD USDJPY                            Dukascopy 1m BID candles (the live feed only has
//                                            the ECB daily rate for these two)
//
// Prices are stored as integers (price x 10^dp, dp from SPECS) in one file per
// symbol and month under CANDLE_DIR (default: <tmp>/copy-matrix-candles/m1),
// outside the project. Finished months are downloaded once; the current month
// is fetched again on every run. A minute with no trade is filled with the
// previous close and flagged as not real -- the engine never opens a trade on
// one, and a flat candle can never touch a level.

import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
export const CANDLE_DIR = process.env.CANDLE_DIR || join(tmpdir(), "copy-matrix-candles", "m1");

// Decimals the prices are stored with (same as SPECS[sym].dp in engine.mjs).
export const DP = { BTCUSDT: 2, ETHUSDT: 2, SOLUSDT: 3, BNBUSDT: 2, XRPUSDT: 4, XAUUSD: 2, EURUSD: 5, GBPUSD: 5, USDJPY: 3 };

export const FEEDS = {
  BTCUSDT: { src: "binance", pair: "BTCUSDT" },
  ETHUSDT: { src: "binance", pair: "ETHUSDT" },
  SOLUSDT: { src: "binance", pair: "SOLUSDT" },
  BNBUSDT: { src: "binance", pair: "BNBUSDT" },
  XRPUSDT: { src: "binance", pair: "XRPUSDT" },
  XAUUSD: { src: "binance", pair: "PAXGUSDT" },
  EURUSD: { src: "binance", pair: "EURUSDT" },
  GBPUSD: { src: "dukascopy", inst: "GBPUSD", point: 1e5 },
  USDJPY: { src: "dukascopy", inst: "USDJPY", point: 1e3 },
};
export const SYMBOLS = Object.keys(FEEDS);

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";
const BINANCE = "https://data-api.binance.vision/api/v3/klines";

async function getWithRetry(url, asJson) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return asJson ? await res.json() : Buffer.from(await res.arrayBuffer());
    } catch (err) {
      if (attempt >= 6) throw err;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
}

async function pool(items, size, fn) {
  let next = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i], i);
    }
  });
  await Promise.all(workers);
}

const monthStart = (y, m) => Date.UTC(y, m, 1);
const monthKey = (y, m) => `${y}-${String(m + 1).padStart(2, "0")}`;

// One month as [o, h, l, c, real] x minutes (Int32), real = 1 for a traded minute.
async function fetchMonthBinance(pair, dp, from, to) {
  const n = Math.round((to - from) / MINUTE);
  const out = new Int32Array(n * 5);
  const scale = 10 ** dp;
  const starts = [];
  for (let t = from; t < to; t += 1000 * MINUTE) starts.push(t);
  await pool(starts, 5, async (start) => {
    const end = Math.min(to, start + 1000 * MINUTE) - 1;
    const rows = await getWithRetry(`${BINANCE}?symbol=${pair}&interval=1m&startTime=${start}&endTime=${end}&limit=1000`, true);
    for (const r of rows ?? []) {
      const i = Math.round((r[0] - from) / MINUTE);
      if (i < 0 || i >= n) continue;
      out.set([Math.round(+r[1] * scale), Math.round(+r[2] * scale), Math.round(+r[3] * scale), Math.round(+r[4] * scale), 1], i * 5);
    }
  });
  return out;
}

// Dukascopy day file: 24-byte records (seconds into the day, open, close, low,
// high as integer points, volume as float), LZMA compressed. Decoded with xz.
export function decodeDukascopyDay(buf) {
  if (!buf || buf.length === 0) return [];
  const res = spawnSync("xz", ["--format=lzma", "-dc"], { input: buf, maxBuffer: 1 << 24 });
  if (res.status !== 0) throw new Error(`xz failed: ${res.stderr}`);
  const b = res.stdout;
  const rows = [];
  for (let o = 0; o + 24 <= b.length; o += 24) {
    rows.push({
      sec: b.readUInt32BE(o),
      o: b.readUInt32BE(o + 4),
      c: b.readUInt32BE(o + 8),
      l: b.readUInt32BE(o + 12),
      h: b.readUInt32BE(o + 16),
      vol: b.readFloatBE(o + 20),
    });
  }
  return rows;
}

async function fetchMonthDukascopy(feed, dp, from, to) {
  const n = Math.round((to - from) / MINUTE);
  const out = new Int32Array(n * 5);
  const conv = 10 ** dp / feed.point; // points -> stored integer
  const days = [];
  for (let t = from; t < to; t += DAY) days.push(t);
  await pool(days, 1, async (day) => {
    await new Promise((r) => setTimeout(r, 250)); // Dukascopy blocks bursts
    const d = new Date(day);
    const url = `https://datafeed.dukascopy.com/datafeed/${feed.inst}/${d.getUTCFullYear()}/${String(d.getUTCMonth()).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}/BID_candles_min_1.bi5`;
    const buf = await getWithRetry(url, false);
    for (const r of decodeDukascopyDay(buf)) {
      if (!(r.vol > 0)) continue; // a quiet (closed-market) minute
      const i = Math.round((day + r.sec * 1000 - from) / MINUTE);
      if (i < 0 || i >= n) continue;
      out.set([Math.round(r.o * conv), Math.round(r.h * conv), Math.round(r.l * conv), Math.round(r.c * conv), 1], i * 5);
    }
  });
  return out;
}

async function loadMonth(sym, y, m, nowMs, log) {
  const from = monthStart(y, m);
  const to = monthStart(y, m + 1);
  const finished = to <= nowMs - DAY;
  const dir = join(CANDLE_DIR, sym);
  const file = join(dir, `${monthKey(y, m)}.bin`);
  if (finished && existsSync(file)) {
    const b = readFileSync(file);
    return new Int32Array(b.buffer, b.byteOffset, b.length / 4);
  }
  mkdirSync(dir, { recursive: true });
  log(`downloading ${sym} ${monthKey(y, m)}`);
  const feed = FEEDS[sym];
  const end = Math.min(to, Math.floor(nowMs / MINUTE) * MINUTE);
  const part = feed.src === "binance" ? await fetchMonthBinance(feed.pair, DP[sym], from, end) : await fetchMonthDukascopy(feed, DP[sym], from, end);
  const data = new Int32Array(Math.round((to - from) / MINUTE) * 5);
  data.set(part);
  if (finished) writeFileSync(file, Buffer.from(data.buffer));
  return data;
}

// Dense minute series of one symbol over [fromMs, toMs). Prices are integers;
// p(x) turns one back into a price.
export class MinuteSeries {
  constructor(sym, fromMs, toMs, months) {
    this.sym = sym;
    this.dp = DP[sym];
    this.scale = 10 ** this.dp;
    this.from = fromMs;
    this.n = Math.round((toMs - fromMs) / MINUTE);
    this.o = new Int32Array(this.n);
    this.h = new Int32Array(this.n);
    this.l = new Int32Array(this.n);
    this.c = new Int32Array(this.n);
    this.real = new Uint8Array(this.n);
    let last = 0;
    for (const { start, data } of months) {
      const len = data.length / 5;
      for (let k = 0; k < len; k++) {
        const i = Math.round((start + k * MINUTE - fromMs) / MINUTE);
        if (i < 0 || i >= this.n) continue;
        if (data[k * 5 + 4]) {
          this.o[i] = data[k * 5];
          this.h[i] = data[k * 5 + 1];
          this.l[i] = data[k * 5 + 2];
          this.c[i] = data[k * 5 + 3];
          this.real[i] = 1;
          last = this.c[i];
        } else {
          this.o[i] = this.h[i] = this.l[i] = this.c[i] = last;
        }
      }
    }
    // Leading minutes before the first trade take the first real price.
    const first = this.real.indexOf(1);
    if (first > 0) for (let i = 0; i < first; i++) this.o[i] = this.h[i] = this.l[i] = this.c[i] = this.o[first];
    this.buildHours();
  }

  // Hour-level high / low, so a scan can skip an hour that touches no level.
  buildHours() {
    const nh = Math.ceil(this.n / 60);
    this.hh = new Int32Array(nh);
    this.hl = new Int32Array(nh);
    for (let k = 0; k < nh; k++) {
      let hi = -Infinity;
      let lo = Infinity;
      for (let i = k * 60; i < Math.min(this.n, k * 60 + 60); i++) {
        if (this.h[i] > hi) hi = this.h[i];
        if (this.l[i] < lo) lo = this.l[i];
      }
      this.hh[k] = hi;
      this.hl[k] = lo;
    }
  }

  index(ms) {
    return Math.floor((ms - this.from) / MINUTE);
  }
  time(i) {
    return this.from + i * MINUTE;
  }
  p(x) {
    return x / this.scale;
  }
}

// Every symbol's minute series over [fromMs, toMs).
export async function loadCandles(fromMs, toMs, { log = () => {}, symbols = SYMBOLS, nowMs = Date.now() } = {}) {
  const out = {};
  for (const sym of symbols) {
    const months = [];
    const a = new Date(fromMs);
    for (let y = a.getUTCFullYear(), m = a.getUTCMonth(); monthStart(y, m) < toMs; m++) {
      if (m === 12) {
        m = 0;
        y++;
      }
      months.push({ start: monthStart(y, m), data: await loadMonth(sym, y, m, nowMs, log) });
    }
    out[sym] = new MinuteSeries(sym, fromMs, toMs, months);
  }
  return out;
}
