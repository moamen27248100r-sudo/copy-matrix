// Leader trading engine used to rebuild a simulated leader's history from real
// 1-minute prices (candles.mjs). It never looks ahead: every decision at a
// minute uses that minute's opening price and earlier data only, and the
// live engine (public.sim_open_trade / public.sim_advance_trade) applies the
// same rules to the live feed:
//
// - when: trades arrive at random inside the leader's sessions (Poisson, at
//   the persona's trades-per-day rate), never while the symbol's market is
//   closed and never on a minute with no real trade;
// - direction (persona v3, with a trend lookback `tlb`): with probability
//   `follow` the strategy decides from the move over the short lookback `lb`
//   and the long one `tlb` -- "trend" buys pullbacks in an uptrend / sells
//   rallies in a downtrend, "breakout" trades when both moves agree,
//   "reversion" fades a move when both agree (over-extended) -- and
//   skips the trade when its condition isn't met; otherwise a coin flip.
//   (v2 personas, without `tlb`: follow / fade the short move);
// - entry: the minute's opening price plus half the spread (a buy pays the
//   ask, a sell receives the bid);
// - levels: the stop sits at the volatility expected over the holding time
//   (trailing 30-day hourly volatility, completed hours only) times k_sl, the
//   target at the stop times the reward:risk;
// - size: risk_pct of the realised equity over the stop distance, capped by
//   the leverage;
// - exit: the first later minute whose range reaches the stop or the target
//   on the exit side of the spread closes the trade AT that level (stop first
//   when one candle reaches both); otherwise, once the holding time is up,
//   the trade closes at the market (that minute's open less half the spread).
//   Scalpers and day traders also go flat a few minutes before a gold / forex
//   market closes for the weekend;
// - hourly symbols (GBPUSD / USDJPY, see candles.mjs): a decision taken inside
//   an hour is filled at the next hour's open, and market exits happen at hour
//   opens -- the only prices of those series;
// - costs: spread (in the prices), commission, overnight swap.
//
// Prices are integers (price x 10^dp) and money is in cents, rounded half
// away from zero exactly like Postgres numeric round(), so the P&L here is
// the same number public.sim_close_trade computes.

import { Rng } from "./rng.mjs";
import { MINUTE, HOUR, DAY } from "./candles.mjs";
import { RISK_LIMITS } from "./personas.mjs";

// pip / pip value match public.trade_profit_usd. spread = full spread in
// price units (spreadRel: as a share of the price).
export const SPECS = {
  XAUUSD: { pip: 0.1, val: 10, step: 0.01, dp: 2, kind: "metal", comm: 7, swap: -3, spread: 0.15 },
  EURUSD: { pip: 0.0001, val: 10, step: 0.01, dp: 5, kind: "fx", comm: 7, swap: -0.8, spread: 0.00002 },
  GBPUSD: { pip: 0.0001, val: 10, step: 0.01, dp: 5, kind: "fx", comm: 7, swap: -1, spread: 0.00003 },
  USDJPY: { pip: 0.01, val: 9, step: 0.01, dp: 3, kind: "fxjpy", comm: 7, swap: -0.8, spread: 0.003 },
  BTCUSDT: { pip: 1, val: 1, step: 0.001, dp: 2, kind: "crypto", fee: 0.0002, spreadRel: 0.00002 },
  ETHUSDT: { pip: 0.1, val: 1, step: 0.001, dp: 2, kind: "crypto", fee: 0.0002, spreadRel: 0.00002 },
  SOLUSDT: { pip: 0.01, val: 1, step: 0.001, dp: 3, kind: "crypto", fee: 0.0002, spreadRel: 0.00002 },
  BNBUSDT: { pip: 0.1, val: 1, step: 0.001, dp: 2, kind: "crypto", fee: 0.0002, spreadRel: 0.00002 },
  XRPUSDT: { pip: 0.0001, val: 1, step: 0.001, dp: 4, kind: "crypto", fee: 0.0002, spreadRel: 0.00002 },
};

export const units = (sym) => SPECS[sym].val / SPECS[sym].pip;
export const isCrypto = (sym) => SPECS[sym].kind === "crypto";
const pipInt = (sym) => Math.round(SPECS[sym].pip * 10 ** SPECS[sym].dp);
const stepMilli = (sym) => Math.round(SPECS[sym].step * 1000);

// Half the spread in integer price units at an integer price.
export function halfSpread(sym, priceInt) {
  const s = SPECS[sym];
  const full = s.spreadRel != null ? priceInt * s.spreadRel : s.spread * 10 ** s.dp;
  return Math.max(1, Math.round(full / 2));
}

// Gold and forex close from Friday 22:00 to Sunday 22:00 UTC and on 1 Jan /
// 25 Dec (public.sim_market_open).
export function marketOpen(sym, ms) {
  if (isCrypto(sym)) return true;
  const day = Math.floor(ms / DAY);
  const dow = (day + 4) % 7; // 1970-01-01 was a Thursday
  const h = Math.floor(ms / HOUR) % 24;
  if (dow === 6 || (dow === 0 && h < 22) || (dow === 5 && h >= 22)) return false;
  const d = new Date(ms);
  const md = d.getUTCMonth() * 100 + d.getUTCDate();
  return md !== 1 && md !== 1125;
}

// ---------------------------------------------------------------- exact money

const big = BigInt;
// n / d rounded half away from zero (d > 0).
function roundDiv(n, d) {
  if (n >= 0n) return (2n * n + d) / (2n * d);
  return -((-2n * n + d) / (2n * d));
}
// A decimal (e.g. 0.0002, -0.8) as an exact fraction.
function frac(x) {
  const s = String(x);
  const dot = s.indexOf(".");
  if (dot < 0) return [big(s), 1n];
  const dec = s.length - dot - 1;
  return [big(s.replace(".", "")), 10n ** big(dec)];
}

// Notional in USD of `lotMilli` thousandths of a lot at an integer price, as a fraction.
function notionalFrac(sym, lotMilli, priceInt) {
  const s = SPECS[sym];
  const scale = 10n ** big(s.dp);
  if (s.kind === "fx") return [big(lotMilli) * 100000n * big(priceInt), 1000n * scale];
  if (s.kind === "fxjpy") return [big(lotMilli) * 100000n, 1000n];
  // lot x (val / pip) x price
  return [big(lotMilli) * big(s.val) * big(priceInt), 1000n * big(pipInt(sym))];
}
export function notionalUsd(sym, lotMilli, priceInt) {
  const [n, d] = notionalFrac(sym, lotMilli, priceInt);
  return Number(n) / Number(d);
}

// Gross result in cents: (exit - entry) x dir x (val / pip) x lot.
export function grossCents(sym, dir, entryInt, exitInt, lotMilli) {
  const s = SPECS[sym];
  return Number(roundDiv(big(exitInt - entryInt) * big(dir) * big(s.val) * big(lotMilli) * 100n, big(pipInt(sym)) * 1000n));
}

// Overnight rollovers (22:00 UTC) held through while the market was open.
export function swapNights(sym, openMs, closeMs) {
  let nights = 0;
  let roll = Math.floor(openMs / DAY) * DAY + 22 * HOUR;
  if (roll <= openMs) roll += DAY;
  for (; roll < closeMs; roll += DAY) if (marketOpen(sym, roll - HOUR)) nights++;
  return nights;
}

export function costsCents(sym, lotMilli, entryInt, exitInt, openMs, closeMs) {
  const s = SPECS[sym];
  if (s.kind === "crypto") {
    const [fn, fd] = frac(s.fee);
    const [n1, d1] = notionalFrac(sym, lotMilli, entryInt);
    const [n2] = notionalFrac(sym, lotMilli, exitInt);
    // fee x (notional at entry + notional at exit) / 2
    return { commission: Number(roundDiv(fn * (n1 + n2) * 100n, fd * d1 * 2n)), swap: 0 };
  }
  const [cn, cd] = frac(s.comm);
  const [sn, sd] = frac(s.swap);
  const nights = swapNights(sym, openMs, closeMs);
  return {
    commission: Number(roundDiv(cn * big(lotMilli) * 100n, cd * 1000n)),
    swap: Number(roundDiv(sn * big(lotMilli) * big(nights) * 100n, sd * 1000n)),
  };
}

// pnl / equity x 100, 4 decimals.
export function returnPct(pnlCents, equityCents) {
  if (equityCents <= 0) return null;
  return Number(roundDiv(big(pnlCents) * 1000000n, big(equityCents))) / 10000;
}

// ---------------------------------------------------------------- market data

// Per-symbol helpers on a MinuteSeries: market-open flags and the trailing
// volatility of completed hours.
export class Market {
  constructor(seriesBySymbol) {
    this.s = seriesBySymbol;
    this.open = {};
    this.hourOpen = {};
    this.sigma = {};
    for (const [sym, ser] of Object.entries(seriesBySymbol)) {
      const open = new Uint8Array(ser.n);
      const nh = Math.ceil(ser.n / 60);
      const hourOpen = new Uint8Array(nh);
      for (let k = 0; k < nh; k++) {
        const o = marketOpen(sym, ser.time(k * 60)) ? 1 : 0;
        hourOpen[k] = o;
        open.fill(o, k * 60, Math.min(ser.n, k * 60 + 60));
      }
      this.open[sym] = open;
      this.hourOpen[sym] = hourOpen;
      this.sigma[sym] = trailingSigma(ser, hourOpen);
    }
  }
}

// sigma[k]: standard deviation of the hourly log returns of the 720 open
// hours before hour k (hour k itself excluded).
function trailingSigma(ser, hourOpen) {
  const nh = Math.ceil(ser.n / 60);
  const close = (k) => ser.c[Math.min(ser.n - 1, k * 60 + 59)];
  const out = new Float64Array(nh);
  const W = 720;
  const window = [];
  let s2 = 0;
  for (let k = 0; k < nh; k++) {
    out[k] = window.length > 24 ? Math.sqrt(s2 / window.length) : 0.006;
    if (k >= 1 && hourOpen[k]) {
      const r = Math.log(close(k) / close(k - 1));
      if (r !== 0 && Number.isFinite(r)) {
        window.push(r);
        s2 += r * r;
        if (window.length > W) s2 -= window.shift() ** 2;
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- engine

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const dayKey = (ms) => Math.floor(ms / DAY);
const FLAT_BEFORE_CLOSE_MIN = 5;

export function sessionWeight(persona, hourOfDay) {
  for (const [a, b, w] of persona.sessions) if (hourOfDay >= a && hourOfDay < b) return w;
  return 0;
}
export function sessionMinutesPerDay(persona) {
  let m = 0;
  for (const [a, b, w] of persona.sessions) m += (b - a) * 60 * w;
  return m;
}
export const flatsBeforeClose = (persona, sym) => !isCrypto(sym) && (persona.style === "scalper" || persona.style === "day");

// Direction from past prices only (integer prices). 0 = no trade.
export function signalDir(persona, nowInt, thenInt, coin, follow, longThenInt = null) {
  if (persona.tlb == null) {
    if (follow < persona.follow && nowInt !== thenInt) {
      const up = nowInt > thenInt ? 1 : -1;
      return persona.strat === "reversion" ? -up : up;
    }
    return coin < 0.5 ? 1 : -1;
  }
  if (follow < persona.follow) {
    const s = Math.sign(nowInt - thenInt);
    const l = Math.sign(nowInt - longThenInt);
    if (s === 0 || l === 0) return 0;
    if (persona.strat === "trend") return s === -l ? l : 0;
    if (persona.strat === "breakout") return s === l ? l : 0;
    return s === l ? -s : 0; // reversion: fade an over-extended move
  }
  return coin < 0.5 ? 1 : -1;
}

// Where a trade opened at minute i0 ends on the real path. Returns
// { i, exit, trigger, exitMs } or null when it is still open at endIdx.
export function resolveTrade(market, t, endIdx) {
  const ser = market.s[t.sym];
  const open = market.open[t.sym];
  const hourOpen = market.hourOpen[t.sym];
  const { dir, sl, tp, i0, holdMin, half, flat } = t;
  const iStop = i0 + holdMin;
  let i = i0;
  while (i < endIdx) {
    const k = Math.floor(i / 60);
    if (i % 60 === 0 && i + 60 <= endIdx) {
      if (!hourOpen[k]) {
        i += 60;
        continue;
      }
      // A whole open hour that reaches neither level and holds no decision.
      if (i + 60 <= iStop && (!flat || hourOpen[k + 1])) {
        const adverse = (dir > 0 ? ser.hl[k] : ser.hh[k]) - dir * half;
        const favour = (dir > 0 ? ser.hh[k] : ser.hl[k]) - dir * half;
        if ((adverse - sl) * dir > 0 && (favour - tp) * dir < 0) {
          i += 60;
          continue;
        }
      }
    }
    if (!open[i]) {
      i++;
      continue;
    }
    const adverse = (dir > 0 ? ser.l[i] : ser.h[i]) - dir * half;
    const favour = (dir > 0 ? ser.h[i] : ser.l[i]) - dir * half;
    // Inside one candle the order is unknown: the stop is assumed first.
    if ((adverse - sl) * dir <= 0) return { i, exit: sl, trigger: "sl", exitMs: ser.time(i) + 30_000 };
    if ((favour - tp) * dir >= 0) return { i, exit: tp, trigger: "tp", exitMs: ser.time(i) + 30_000 };
    const closing = flat && (i + FLAT_BEFORE_CLOSE_MIN >= ser.n || !open[i + FLAT_BEFORE_CLOSE_MIN]);
    if ((i >= iStop || (closing && i > i0)) && (!ser.hourly || ser.real[i])) {
      return { i, exit: ser.o[i] - dir * half, trigger: i >= iStop ? "timeout" : "manual", exitMs: ser.time(i) };
    }
    i++;
  }
  return null;
}

// Plans a trade at minute index i (null when it can't be opened).
export function planTrade(persona, market, rng, sym, i, equityCents, riskMult = 1) {
  const ser = market.s[sym];
  const spec = SPECS[sym];
  // An hourly series only has a price at each hour's open: the order fills there.
  if (ser.hourly && !ser.real[i]) {
    const j = i + 60 - (i % 60);
    if (j >= ser.n || !ser.real[j]) return null;
    i = j;
  }
  if (!ser.real[i] || !market.open[sym][i]) return null;
  // Scalpers and day traders don't open into a market that closes within 30 minutes.
  if (flatsBeforeClose(persona, sym) && (i + 30 >= ser.n || !market.open[sym][i + 30])) return null;
  const lb = persona.lb;
  const tlb = persona.tlb ?? lb;
  if (i - Math.max(lb, tlb) < 0) return null;
  const now = ser.o[i];
  const dir = signalDir(persona, now, ser.o[i - lb], rng.float(), rng.float(), ser.o[i - tlb]);
  if (!dir) return null;
  const holdMin = Math.max(1, Math.round(Math.exp(rng.range(Math.log(persona.hold[0]), Math.log(persona.hold[1])))));
  const half = halfSpread(sym, now);
  const entry = now + dir * half;
  const sigma = market.sigma[sym][Math.floor(i / 60)];
  const scale = 10 ** spec.dp;
  let slDist = (entry / scale) * sigma * Math.sqrt(Math.max(holdMin, 5) / 60) * persona.k_sl * rng.range(0.8, 1.25);
  slDist = Math.max(slDist, spec.pip * (spec.kind === "crypto" ? 5 : 8), (entry / scale) * 0.0004);
  const tpDist = slDist * persona.rr * rng.range(0.85, 1.18);
  const slInt = Math.round(slDist * scale);
  const tpInt = Math.round(tpDist * scale);
  const sl = entry - dir * slInt;
  const tp = entry + dir * tpInt;
  if (sl <= 0 || slInt <= 0 || tpInt <= 0) return null;

  // Lot (in thousandths) from the risk budget, capped by the leverage.
  const equity = equityCents / 100;
  const riskUsd = equity * (persona.risk_pct / 100) * riskMult * rng.range(0.85, 1.15);
  const step = stepMilli(sym);
  const perMilli = slDist * units(sym) / 1000; // USD lost at the stop per 0.001 lot
  let lot = Math.floor(riskUsd / perMilli / step) * step;
  const maxLot = Math.floor((equity * persona.lev) / notionalUsd(sym, 1000, entry) * 1000 / step) * step;
  lot = Math.min(lot, maxLot);
  if (lot < step) {
    // The minimum lot is only taken when it doesn't triple the intended risk.
    if (step * perMilli > riskUsd * 3) return null;
    lot = step;
  }
  const riskPct = (lot * perMilli * 100) / equity;
  return { sym, dir, side: dir > 0 ? "buy" : "sell", entry, sl, tp, lot, half, i0: i, openMs: ser.time(i), holdMin, riskPct, flat: flatsBeforeClose(persona, sym) };
}

// A v3 strategy skips about half of its signal-led chances (its condition is
// not met), so chances arrive that much more often and the leader keeps the
// profile's trades per day. A constant per persona -- no price involved.
export const filterRateFactor = (persona) => (persona.tlb == null ? 1 : 1 / (1 - 0.5 * persona.follow));

// Drawdown brake: past the profile's lower drawdown bound the leader halves
// the risk per trade; near the upper bound a quarter, and no new trade until
// 7 days after the last closed one. `dd` is the drawdown of the
// time-weighted equity index including today's realised result.
export const DD_PAUSE_MS = 7 * DAY;
export function drawdownBrake(persona, dd, sinceLastCloseMs) {
  const [lo, hi] = persona.dd;
  if (dd >= hi * 0.9) return sinceLastCloseMs < DD_PAUSE_MS ? 0 : 0.25;
  return dd > lo ? 0.5 : 1;
}

// Exposure factor: multi-day trades rarely all close on the same day.
export const exposureFactor = (persona) => ({ scalper: 0.85, day: 0.85, swing: 1.25, position: 1.2 })[persona.style];

function poisson(rng, lambda) {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = rng.float();
  while (p > L) {
    k++;
    p *= rng.float();
  }
  return k;
}

// Simulates one leader over [startMs, endMs). Money in cents.
export function simulateLeader(persona, market, { startMs, endMs, seed }) {
  const rng = new Rng(seed);
  const limits = RISK_LIMITS[persona.risk];
  const any = Object.values(market.s)[0];
  const endIdx = any.index(endMs);
  const trades = [];
  const cashFlows = [];
  const days = new Map();
  const open = [];
  const pending = []; // trades with a known exit, sorted by exitMs

  let equity = 0; // cents
  let logIdx = 0;
  let peakLog = 0;
  let lastCloseMs = -Infinity;
  let curDay = dayKey(startMs);
  let dayStart = 0;
  let dayPnl = 0;
  let dayCash = 0;
  let monthIdx = new Date(startMs).getUTCMonth();
  let monthLog = 0;
  let monthPnl = 0;
  let extremeYear = -1;
  let tradeNo = 0;

  const perMinute = (persona.tpd / sessionMinutesPerDay(persona)) * filterRateFactor(persona);
  const symbols = Object.fromEntries(Object.entries(persona.assets).filter(([s]) => market.s[s]));
  const dayRec = (k) => {
    let r = days.get(k);
    if (!r) days.set(k, (r = { trades: 0, wins: 0, pnl: 0, cash: 0, start: 0 }));
    return r;
  };

  const closeTrade = (tr) => {
    equity += tr.pnl;
    dayPnl += tr.pnl;
    monthPnl += tr.pnl;
    const r = dayRec(dayKey(tr.exitMs));
    r.trades++;
    if (tr.pnl > 0) r.wins++;
    r.pnl += tr.pnl;
    lastCloseMs = tr.exitMs;
    open.splice(open.indexOf(tr), 1);
  };
  const applyCloses = (ms) => {
    while (pending.length && pending[0].exitMs <= ms) closeTrade(pending.shift());
  };
  const finishDay = () => {
    const r = dayRec(curDay);
    r.start = dayStart;
    r.cash = dayCash;
    const base = dayStart + dayCash;
    const ret = base > 0 ? dayPnl / base : 0;
    logIdx += Math.log(Math.max(1e-6, 1 + ret));
    peakLog = Math.max(peakLog, logIdx);
    monthLog += Math.log(Math.max(1e-6, 1 + ret));
  };
  const addCash = (ms, amountCents, kind) => {
    const amount = Math.round(amountCents / 1000) * 1000; // whole $10
    if (!amount) return;
    equity += amount;
    dayCash += amount;
    cashFlows.push({ at: ms, amount, kind });
  };
  const cap0 = persona.cap0 * 100;
  const monthStart = (ms) => {
    // Withdrawals after a profitable month, top-ups after a wipe-out.
    if (monthPnl > 0 && rng.chance(persona.wd_prob) && equity - monthPnl * persona.wd_frac > cap0 * 0.8) {
      addCash(ms + rng.int(1, 600) * MINUTE, -monthPnl * persona.wd_frac, "withdrawal");
    }
    if (equity < cap0 * 0.3 && rng.chance(persona.key === "gambler" ? 0.9 : 0.7)) {
      addCash(ms + rng.int(1, 600) * MINUTE, cap0 * rng.range(0.5, 1) - equity, "deposit");
    }
    monthLog = 0;
    monthPnl = 0;
  };
  const rollTo = (ms) => {
    const k = dayKey(ms);
    while (curDay < k) {
      applyCloses((curDay + 1) * DAY - 1);
      finishDay();
      curDay++;
      dayStart = equity;
      dayPnl = 0;
      dayCash = 0;
      const dayMs = curDay * DAY;
      const m = new Date(dayMs).getUTCMonth();
      if (m !== monthIdx) {
        monthIdx = m;
        monthStart(dayMs);
      }
      if (equity < cap0 * 0.12 && !open.length) addCash(dayMs, cap0 * rng.range(0.4, 0.8) - equity, "deposit");
    }
  };

  const tryOpen = (ms) => {
    if (open.length >= persona.max_open) return;
    // Daily / monthly brakes on the realised result.
    const dayBase = dayStart + dayCash;
    const dayRet = dayBase > 0 ? dayPnl / dayBase : 0;
    if (Math.abs(dayRet) >= limits.day * 0.7) return;
    const monthRet = Math.exp(monthLog + Math.log(Math.max(1e-6, 1 + dayRet))) - 1;
    const year = new Date(ms).getUTCFullYear();
    const [nLo, nHi] = limits.monthNormal;
    const [xLo, xHi] = limits.month;
    if (monthRet <= xLo * 0.85 || monthRet >= xHi * 0.85) return;
    if (monthRet <= nLo * 0.9 || monthRet >= nHi * 0.9) {
      if (persona.risk !== "high" || extremeYear === year) return;
    }
    if (persona.risk === "high" && (monthRet < nLo || monthRet > nHi)) extremeYear = year;
    // Open risk stays inside the daily limit.
    const exposure = open.reduce((a, o) => a + o.riskPct * Math.max(1, persona.rr), 0);
    if (exposure + persona.risk_pct * Math.max(1, persona.rr) > limits.day * 100 * exposureFactor(persona)) return;
    if (equity <= 0) return;
    const curLog = logIdx + Math.log(Math.max(1e-6, 1 + dayRet));
    const dd = 1 - Math.exp(curLog - Math.max(peakLog, curLog));
    const riskMult = drawdownBrake(persona, dd, ms - lastCloseMs);
    if (!riskMult) return;

    const sym = rng.weighted(symbols);
    const ser = market.s[sym];
    const t = planTrade(persona, market, rng, sym, ser.index(ms), equity, riskMult);
    if (!t) return;
    t.no = ++tradeNo;
    t.equityAtOpen = equity;
    const res = resolveTrade(market, t, endIdx);
    open.push(t);
    trades.push(t);
    if (!res) {
      t.stillOpen = true;
      return;
    }
    Object.assign(t, res);
    const costs = costsCents(sym, t.lot, t.entry, t.exit, t.openMs, t.exitMs);
    t.commission = costs.commission;
    t.swap = costs.swap;
    t.gross = grossCents(sym, t.dir, t.entry, t.exit, t.lot);
    t.pnl = t.gross - t.commission + t.swap;
    t.returnPct = returnPct(t.pnl, t.equityAtOpen);
    let j = pending.length;
    while (j > 0 && pending[j - 1].exitMs > t.exitMs) j--;
    pending.splice(j, 0, t);
  };

  addCash(startMs, cap0, "deposit");
  const firstHour = Math.ceil(startMs / HOUR) * HOUR;
  for (let h = firstHour; h < endMs; h += HOUR) {
    rollTo(h);
    const hourOfDay = Math.floor(h / HOUR) % 24;
    const w = sessionWeight(persona, hourOfDay);
    if (!w) continue;
    if (!persona.weekend) {
      const dow = (Math.floor(h / DAY) + 4) % 7;
      if (dow === 0 || dow === 6) continue;
    }
    const n = poisson(rng, perMinute * w * 60);
    if (!n) continue;
    const mins = Array.from({ length: n }, () => rng.int(0, 59)).sort((a, b) => a - b);
    for (const m of mins) {
      const ms = h + m * MINUTE;
      if (ms >= endMs) break;
      applyCloses(ms);
      tryOpen(ms);
    }
  }
  rollTo(endMs);
  applyCloses(endMs - 1);
  finishDay();

  const daily = [...days.entries()].sort((a, b) => a[0] - b[0]);
  return { trades, cashFlows, daily, equity };
}

// ---------------------------------------------------------------- followers

// Followers react to the last 90 days' return, the current drawdown and the
// length of the track record; AUM = followers x average copy size.
export function followerSeries(persona, daily, seed) {
  const rng = new Rng(seed);
  let F = 0;
  let logIdx = 0;
  let peak = 0;
  const window = [];
  const out = [];
  const first = daily.length ? daily[0][0] : 0;
  for (const [k, r] of daily) {
    const base = r.start + r.cash;
    const ret = base > 0 ? r.pnl / base : 0;
    logIdx += Math.log(Math.max(1e-6, 1 + ret));
    peak = Math.max(peak, logIdx);
    window.push(Math.log(Math.max(1e-6, 1 + ret)));
    if (window.length > 90) window.shift();
    const roi90 = Math.exp(window.reduce((a, b) => a + b, 0)) - 1;
    const dd = 1 - Math.exp(logIdx - peak);
    const track = k - first;
    const target =
      persona.pop *
      Math.exp(2.2 * clamp(roi90, -0.6, 1.2)) *
      Math.pow(1 - clamp(dd, 0, 0.9), 1.5) *
      Math.pow(Math.min(1, (track + 15) / 240), 0.7);
    F = Math.max(0, F + 0.05 * (target - F) + rng.gauss() * Math.sqrt(F + 1) * 0.3);
    const aum = Math.round(F) * persona.copy_avg * (1 + 0.1 * Math.sin(track / 37 + (persona.seed % 7)));
    out.push({ day: k, followers: Math.round(F), aum: Math.round(aum) });
  }
  return out;
}
