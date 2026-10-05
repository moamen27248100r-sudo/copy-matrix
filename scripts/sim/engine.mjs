// Leader trading engine used to rebuild a simulated leader's history from real
// hourly prices. The live engine (public.run_market_simulation) applies the
// same rules minute by minute:
//
// - a trade opens at the market price, with its lot sized from the leader's
//   equity, risk per trade and stop distance, and real S/L and T/P levels;
// - touching the T/P or S/L closes it right there, at that level;
// - otherwise, once its planned holding time is up, the leader takes the best
//   (planned win) or cuts at the worst (planned loss) price actually traded in
//   the recent window, or closes at the market after a grace period;
// - whether a trade is planned as a win is drawn from the persona's win rate,
//   nudged by how far the equity curve sits from the persona's trajectory.
//
// Every exit is a price that really traded at the close time, P&L follows from
// side, prices and lot, and all stats are computed afterwards from the trades.

import { Rng, hashSeed, mulberry32 } from "./rng.mjs";
import { HOUR } from "./candles.mjs";
import { RISK_LIMITS, targetLog } from "./personas.mjs";

const MINUTE = 60_000;
const DAY_MS = 24 * HOUR;

// pip / pip value match public.trade_profit_usd; units = price units per lot.
export const SPECS = {
  XAUUSD: { pip: 0.1, val: 10, step: 0.01, dp: 2, kind: "metal", comm: 7, swap: -3 },
  EURUSD: { pip: 0.0001, val: 10, step: 0.01, dp: 5, kind: "fx", comm: 7, swap: -0.8 },
  GBPUSD: { pip: 0.0001, val: 10, step: 0.01, dp: 5, kind: "fx", comm: 7, swap: -1 },
  USDJPY: { pip: 0.01, val: 9, step: 0.01, dp: 3, kind: "fxjpy", comm: 7, swap: -0.8 },
  BTCUSDT: { pip: 1, val: 1, step: 0.001, dp: 2, kind: "crypto", fee: 0.0002 },
  ETHUSDT: { pip: 0.1, val: 1, step: 0.001, dp: 2, kind: "crypto", fee: 0.0002 },
  SOLUSDT: { pip: 0.01, val: 1, step: 0.001, dp: 3, kind: "crypto", fee: 0.0002 },
  BNBUSDT: { pip: 0.1, val: 1, step: 0.001, dp: 2, kind: "crypto", fee: 0.0002 },
  XRPUSDT: { pip: 0.0001, val: 1, step: 0.001, dp: 4, kind: "crypto", fee: 0.0002 },
};
// Only multi-day personas trade the two pairs that have no intraday feed.
export const DAILY_ONLY = new Set(["GBPUSD", "USDJPY"]);

export const units = (sym) => SPECS[sym].val / SPECS[sym].pip;
export const isCrypto = (sym) => SPECS[sym].kind === "crypto";

export function notionalUsd(sym, lot, price) {
  const k = SPECS[sym].kind;
  if (k === "fx") return lot * 100000 * price;
  if (k === "fxjpy") return lot * 100000;
  return lot * units(sym) * price;
}

// Gold and forex close from Friday 22:00 to Sunday 22:00 UTC and on 1 Jan / 25 Dec.
export function marketOpen(sym, ms) {
  if (isCrypto(sym)) return true;
  const d = new Date(ms);
  const dow = d.getUTCDay();
  const h = d.getUTCHours();
  if (dow === 6 || (dow === 0 && h < 22) || (dow === 5 && h >= 22)) return false;
  const md = d.getUTCMonth() * 100 + d.getUTCDate();
  return md !== 1 && md !== 1125;
}

export const roundTo = (x, dp) => Math.round(x * 10 ** dp) / 10 ** dp;
const cents = (x) => Math.round(x * 100) / 100;

// ---------------------------------------------------------------- prices

// Minute prices inside each real hourly candle: open -> first extreme -> second
// extreme -> close, with a little bridge noise, never leaving [low, high].
export class PriceBook {
  constructor(seriesBySymbol) {
    this.s = seriesBySymbol;
    this.cache = new Map();
    this.sigma = {};
    for (const [sym, ser] of Object.entries(seriesBySymbol)) this.sigma[sym] = rollingSigma(ser);
  }
  hourPath(sym, i) {
    const key = sym + i;
    let p = this.cache.get(key);
    if (p) return p;
    const ser = this.s[sym];
    const o = ser.o[i], h = ser.h[i], l = ser.l[i], c = ser.c[i];
    p = new Float64Array(61);
    const rnd = mulberry32(hashSeed(key));
    const upFirst = c >= o ? rnd() < 0.3 : rnd() < 0.7;
    const t1 = 3 + Math.floor(rnd() * 25);
    const t2 = 32 + Math.floor(rnd() * 25);
    const anchors = [[0, o], [t1, upFirst ? h : l], [t2, upFirst ? l : h], [60, c]];
    for (let a = 0; a < 3; a++) {
      const [x0, y0] = anchors[a];
      const [x1, y1] = anchors[a + 1];
      let w = 0;
      const amp = Math.abs(y1 - y0) * 0.3 + (h - l) * 0.08;
      const walk = [0];
      for (let x = x0 + 1; x <= x1; x++) walk.push((w += (rnd() - 0.5) * amp));
      const endW = walk[walk.length - 1];
      for (let x = x0; x <= x1; x++) {
        const f = (x - x0) / (x1 - x0 || 1);
        const v = y0 + (y1 - y0) * f + walk[x - x0] - endW * f;
        p[x] = Math.min(h, Math.max(l, v));
      }
    }
    p[t1] = anchors[1][1];
    p[t2] = anchors[2][1];
    if (this.cache.size > 400000) this.cache.clear();
    this.cache.set(key, p);
    return p;
  }
  // Price at a minute timestamp (ms, minute aligned).
  at(sym, ms) {
    const ser = this.s[sym];
    const i = ser.index(ms);
    if (i < 0) return ser.o[0];
    if (i >= ser.n) return ser.c[ser.n - 1];
    return this.hourPath(sym, i)[Math.floor((ms - (ser.from + i * HOUR)) / MINUTE)];
  }
  sigmaAt(sym, ms) {
    const ser = this.s[sym];
    const i = Math.min(ser.n - 1, Math.max(0, ser.index(ms)));
    return this.sigma[sym][i];
  }
  high(sym, i) {
    return this.s[sym].h[i];
  }
  low(sym, i) {
    return this.s[sym].l[i];
  }
}

// Trailing 30-day standard deviation of hourly log returns (moves only).
function rollingSigma(ser) {
  const out = new Float64Array(ser.n);
  const W = 720;
  const r = new Float64Array(ser.n);
  for (let i = 1; i < ser.n; i++) r[i] = Math.log(ser.c[i] / ser.c[i - 1]);
  let s2 = 0;
  let cnt = 0;
  for (let i = 1; i < ser.n; i++) {
    if (r[i] !== 0) {
      s2 += r[i] * r[i];
      cnt++;
    }
    if (i > W && r[i - W] !== 0) {
      s2 -= r[i - W] * r[i - W];
      cnt--;
    }
    out[i] = cnt > 24 ? Math.sqrt(Math.max(0, s2) / cnt) : 0.006;
  }
  out[0] = out[1];
  return out;
}

// ---------------------------------------------------------------- engine

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const dayKey = (ms) => Math.floor(ms / DAY_MS);

function inSession(persona, ms) {
  const d = new Date(ms);
  const h = d.getUTCHours();
  for (const [a, b, w] of persona.sessions) if (h >= a && h < b) return w;
  return 0;
}

function sessionMinutesPerDay(persona) {
  let m = 0;
  for (const [a, b, w] of persona.sessions) m += (b - a) * 60 * w;
  return m;
}

// Holding time in minutes, log-uniform inside the persona's range.
function drawHold(rng, persona) {
  const [lo, hi] = persona.hold;
  return Math.max(1, Math.round(Math.exp(rng.range(Math.log(lo), Math.log(hi)))));
}

export const REGULATOR_GAIN = 4;
export const RETRO_GAIN = 3;
export const EXIT_WINDOW_MAX_MIN = 1440;
// A planned win takes the best recent price once it is worth a share of the
// target that grows with the persona's reward:risk (patient swing traders wait
// longer than scalpers); after 1.5x the holding time any profit will do.
export const winTakeFraction = (rr) => clamp(0.25 + 0.3 * rr, 0.4, 0.9);

// How a trade with these levels resolves on the real path. Returns
// { exitMs, exit, trigger }.
export function resolveTrade(book, t) {
  const { sym, dir, entry, sl, tp, openMs, holdMin, planWin, lossHindsight, take } = t;
  const ser = book.s[sym];
  const tpDist = (tp - entry) * dir;
  const slDist = (entry - sl) * dir;
  const plannedMs = openMs + holdMin * MINUTE;
  const graceMs = openMs + holdMin * MINUTE * (planWin ? 3 : 2);
  const W = exitWindowMin(holdMin) * MINUTE;
  const step = holdMin < 120 ? MINUTE : 15 * MINUTE;
  let nextCheck = plannedMs;
  let ms = openMs + MINUTE;
  const endMs = ser.from + ser.n * HOUR - MINUTE;
  while (ms <= endMs) {
    const i = ser.index(ms);
    const hourStart = ser.from + i * HOUR;
    // Whole hour can be skipped when neither level is inside its range and no
    // exit decision falls inside it.
    if (ms === hourStart && hourStart + HOUR <= nextCheck) {
      const hi = book.high(sym, i);
      const lo = book.low(sym, i);
      const best = dir > 0 ? hi : lo;
      const worst = dir > 0 ? lo : hi;
      if (!marketOpen(sym, ms) || ((best - entry) * dir < tpDist && (entry - worst) * dir < slDist)) {
        ms += HOUR;
        continue;
      }
    }
    if (marketOpen(sym, ms)) {
      const p = book.at(sym, ms);
      const e = (p - entry) * dir;
      if (e >= tpDist) return { exitMs: ms, exit: tp, trigger: "tp" };
      if (e <= -slDist) return { exitMs: ms, exit: sl, trigger: "sl" };
      if (ms >= nextCheck) {
        // A planned loss runs to its levels (or the grace period) unless the
        // curve is above its trajectory: then it is cut at the worst recent price.
        if (!planWin && !lossHindsight) {
          if (ms >= graceMs) return { exitMs: ms, exit: p, trigger: "timeout" };
          nextCheck = graceMs;
          ms += MINUTE;
          continue;
        }
        const late = ms >= openMs + holdMin * MINUTE * 1.5;
        const decided = windowExit(book, sym, dir, entry, Math.max(openMs + MINUTE, ms - W), ms, planWin, (late ? 0 : take) * tpDist, slDist);
        if (decided) return decided;
        if (ms >= graceMs) return { exitMs: ms, exit: p, trigger: "timeout" };
        nextCheck = ms + step;
      }
    }
    ms += MINUTE;
  }
  return null; // still open at the end of the data
}

// Best (planned win) / worst (planned loss) price traded in [fromMs, toMs].
export function exitWindowMin(holdMin) {
  return clamp(holdMin, 1, EXIT_WINDOW_MAX_MIN);
}

function windowExit(book, sym, dir, entry, fromMs, toMs, planWin, winNeed, slDist) {
  const ser = book.s[sym];
  let bestE = planWin ? -Infinity : Infinity;
  let bestMs = 0;
  let bestP = 0;
  const consider = (ms, p) => {
    const e = (p - entry) * dir;
    if (planWin ? e > bestE : e < bestE) {
      bestE = e;
      bestMs = ms;
      bestP = p;
    }
  };
  let ms = fromMs;
  while (ms <= toMs) {
    const i = ser.index(ms);
    const hourStart = ser.from + i * HOUR;
    if (ms === hourStart && hourStart + HOUR - MINUTE <= toMs) {
      // A whole hour: its extreme is the candle's high / low, reached at the
      // minute the path puts it.
      if (marketOpen(sym, ms)) {
        const path = book.hourPath(sym, i);
        const want = (dir > 0) === planWin ? book.high(sym, i) : book.low(sym, i);
        const m = path.indexOf(want);
        if (m >= 0 && m < 60) consider(hourStart + m * MINUTE, want);
        else for (let k = 0; k < 60; k++) consider(hourStart + k * MINUTE, path[k]);
      }
      ms += HOUR;
      continue;
    }
    if (marketOpen(sym, ms)) consider(ms, book.at(sym, ms));
    ms += MINUTE;
  }
  if (planWin && bestE > 0 && bestE >= winNeed) return { exitMs: bestMs, exit: bestP, trigger: "manual" };
  if (!planWin && bestE <= -0.15 * slDist) return { exitMs: bestMs, exit: bestP, trigger: "manual" };
  return null;
}

export function tradeCosts(sym, lot, entry, exit, openMs, closeMs) {
  const s = SPECS[sym];
  if (s.kind === "crypto") {
    return { commission: cents(s.fee * (notionalUsd(sym, lot, entry) + notionalUsd(sym, lot, exit)) / 2), swap: 0 };
  }
  // Overnight financing at each 22:00 UTC rollover held through.
  let nights = 0;
  const firstRoll = Math.ceil((openMs - 22 * HOUR) / DAY_MS) * DAY_MS + 22 * HOUR;
  for (let r = firstRoll; r < closeMs; r += DAY_MS) if (marketOpen(sym, r - HOUR)) nights++;
  return { commission: cents(s.comm * lot), swap: cents(s.swap * lot * nights) };
}

export function grossPnl(sym, dir, entry, exit, lot) {
  return cents((exit - entry) * dir * units(sym) * lot);
}

// Simulates one leader from `startMs` to `endMs`. Returns trades (closed and
// still open), daily rows and cash flows.
export function simulateLeader(persona, book, { startMs, endMs, seed }) {
  const rng = new Rng(seed);
  const limits = RISK_LIMITS[persona.risk];
  const trades = [];
  const cashFlows = [];
  const days = new Map();
  const open = [];
  const pending = []; // closed-on-path trades not yet applied, sorted by exitMs

  let equity = 0;
  let logIdx = 0; // log of the time-weighted index, completed days
  let curDay = dayKey(startMs);
  let dayStart = 0;
  let dayPnl = 0;
  let dayCash = 0;
  let monthIdx = new Date(startMs).getUTCMonth();
  let monthLog = 0;
  let monthPnl = 0;
  let extremeYear = -1;
  let tradeNo = 0;

  const perMinute = persona.tpd / sessionMinutesPerDay(persona);
  const symbols = Object.entries(persona.assets).filter(
    ([s]) => !DAILY_ONLY.has(s) || persona.style === "swing" || persona.style === "position",
  );
  const dayRec = (k) => {
    let r = days.get(k);
    if (!r) days.set(k, (r = { trades: 0, wins: 0, pnl: 0, grossProfit: 0, grossLoss: 0, cash: 0, start: 0, end: 0 }));
    return r;
  };

  const closeTrade = (tr) => {
    equity += tr.pnl;
    dayPnl += tr.pnl;
    monthPnl += tr.pnl;
    const r = dayRec(dayKey(tr.exitMs));
    r.trades++;
    if (tr.pnl > 0) {
      r.wins++;
      r.grossProfit += tr.pnl;
    } else r.grossLoss += -tr.pnl;
    r.pnl += tr.pnl;
    open.splice(open.indexOf(tr), 1);
  };

  const finishDay = () => {
    const r = dayRec(curDay);
    r.start = dayStart;
    r.end = equity;
    r.cash = dayCash;
    const base = dayStart + dayCash;
    const ret = base > 0 ? dayPnl / base : 0;
    logIdx += Math.log(Math.max(1e-6, 1 + ret));
    monthLog += Math.log(Math.max(1e-6, 1 + ret));
  };

  const addCash = (ms, amount, kind) => {
    amount = Math.round(amount / 10) * 10;
    if (!amount) return;
    equity += amount;
    dayCash += amount;
    cashFlows.push({ at: ms, amount, kind });
  };

  const monthStart = (ms) => {
    // Withdrawals after a profitable month, top-ups after a wipe-out.
    if (monthPnl > 0 && rng.chance(persona.wd_prob) && equity - monthPnl * persona.wd_frac > persona.cap0 * 0.8) {
      addCash(ms + rng.int(1, 600) * MINUTE, -monthPnl * persona.wd_frac, "withdrawal");
    }
    if (equity < persona.cap0 * 0.3 && rng.chance(persona.key === "gambler" ? 0.9 : 0.7)) {
      addCash(ms + rng.int(1, 600) * MINUTE, persona.cap0 * rng.range(0.5, 1) - equity, "deposit");
    }
    monthLog = 0;
    monthPnl = 0;
  };

  addCash(startMs, persona.cap0, "deposit");
  const step0 = Math.ceil(startMs / MINUTE) * MINUTE;
  for (let ms = step0; ms < endMs; ms += MINUTE) {
    // Apply trades whose exit time has come.
    while (pending.length && pending[0].exitMs <= ms) closeTrade(pending.shift());

    const k = dayKey(ms);
    if (k !== curDay) {
      finishDay();
      curDay = k;
      dayStart = equity;
      dayPnl = 0;
      dayCash = 0;
      const m = new Date(ms).getUTCMonth();
      if (m !== monthIdx) {
        monthIdx = m;
        monthStart(ms);
      }
    }
    if (equity < persona.cap0 * 0.12 && !open.length) addCash(ms, persona.cap0 * rng.range(0.4, 0.8) - equity, "deposit");

    const w = inSession(persona, ms);
    if (!w || open.length >= persona.max_open) continue;
    if (!persona.weekend) {
      const dow = new Date(ms).getUTCDay();
      if (dow === 0 || dow === 6) continue;
    }
    if (rng.float() >= perMinute * w) continue;

    // Daily / monthly brakes.
    const dayBase = dayStart + dayCash;
    const dayRet = dayBase > 0 ? dayPnl / dayBase : 0;
    if (Math.abs(dayRet) >= limits.day * 0.7) continue;
    const monthRet = Math.exp(monthLog + Math.log(Math.max(1e-6, 1 + dayRet))) - 1;
    const year = new Date(ms).getUTCFullYear();
    const [nLo, nHi] = limits.monthNormal;
    const [xLo, xHi] = limits.month;
    if (monthRet <= xLo * 0.85 || monthRet >= xHi * 0.85) continue;
    if (monthRet <= nLo * 0.9 || monthRet >= nHi * 0.9) {
      if (persona.risk !== "high" || extremeYear === year) continue;
    }
    if (persona.risk === "high" && (monthRet < nLo || monthRet > nHi)) extremeYear = year;

    // Open risk (risk x reward:risk of every open trade) stays inside the
    // daily limit, so trades closing together can't break it.
    const exposure = open.reduce((a, o) => a + o.riskPct * Math.max(1, persona.rr), 0);
    if (exposure + persona.risk_pct * Math.max(1, persona.rr) > limits.day * 100 * exposureFactor(persona)) continue;

    const sym = rng.weighted(Object.fromEntries(symbols));
    if (!marketOpen(sym, ms)) continue;
    const t = planTrade(persona, book, rng, sym, ms, equity, startMs, logIdx + Math.log(Math.max(1e-6, 1 + dayRet)));
    if (!t) continue;
    tradeNo++;
    t.no = tradeNo;
    t.equityAtOpen = equity;
    const res = resolveTrade(book, t);
    open.push(t);
    if (res && res.exitMs < endMs) {
      Object.assign(t, res);
      t.exit = roundTo(t.exit, SPECS[sym].dp);
      const costs = tradeCosts(sym, t.lot, t.entry, t.exit, t.openMs, t.exitMs);
      t.commission = costs.commission;
      t.swap = costs.swap;
      t.gross = grossPnl(sym, t.dir, t.entry, t.exit, t.lot);
      t.pnl = cents(t.gross - t.commission + t.swap);
      t.returnPct = roundTo((t.pnl / t.equityAtOpen) * 100, 4);
      let j = pending.length;
      while (j > 0 && pending[j - 1].exitMs > t.exitMs) j--;
      pending.splice(j, 0, t);
    } else {
      t.stillOpen = true;
    }
    trades.push(t);
  }
  while (pending.length && pending[0].exitMs < endMs) closeTrade(pending.shift());
  finishDay();

  const daily = [...days.entries()].sort((a, b) => a[0] - b[0]);
  return { trades, cashFlows, daily, equity };
}

// Multi-day trades rarely all close on the same day, so they may carry more.
export const exposureFactor = (persona) => ({ scalper: 0.85, day: 0.85, swing: 1.25, position: 1.2 })[persona.style];

export function planTrade(persona, book, rng, sym, ms, equity, startMs, curLog) {
  const spec = SPECS[sym];
  const d = (ms - startMs) / DAY_MS;
  const gap = targetLog(persona.traj, d) - curLog;
  const pWin = clamp(persona.wr + REGULATOR_GAIN * gap, 0.03, 0.97);
  const planWin = rng.chance(pWin);
  const lossHindsight = gap < 0;
  const holdMin = drawHold(rng, persona);
  const entry = roundTo(book.at(sym, ms), spec.dp);
  const sigma = book.sigmaAt(sym, ms);
  let slDist = entry * sigma * Math.sqrt(Math.max(holdMin, 5) / 60) * persona.k_sl * rng.range(0.8, 1.25);
  slDist = Math.max(slDist, spec.pip * (spec.kind === "crypto" ? 5 : 8), entry * 0.0004);
  const tpDist = slDist * persona.rr * rng.range(0.85, 1.18);
  const dir = rng.chance(0.5) ? 1 : -1;
  const riskUsd = equity * (persona.risk_pct / 100) * rng.range(0.85, 1.15);
  let lot = Math.floor(riskUsd / (slDist * units(sym)) / spec.step) * spec.step;
  const maxLot = Math.floor((equity * persona.lev) / notionalUsd(sym, 1, entry) / spec.step) * spec.step;
  lot = Math.min(lot, maxLot);
  if (lot < spec.step) {
    // The minimum lot is only taken when it doesn't triple the intended risk.
    if (spec.step * slDist * units(sym) > riskUsd * 3) return null;
    lot = spec.step;
  }
  lot = roundTo(lot, 3);
  const sl = roundTo(entry - dir * slDist, spec.dp);
  const tp = roundTo(entry + dir * tpDist, spec.dp);
  if (sl <= 0 || sl === entry || tp === entry) return null;
  const riskPct = (lot * slDist * units(sym) * 100) / equity;
  const t = { sym, dir, side: dir > 0 ? "buy" : "sell", entry, sl, tp, lot, openMs: ms, holdMin, planWin, lossHindsight, gap, take: winTakeFraction(persona.rr), riskPct };
  // Planned wins lean on the recent past while the curve is behind its
  // trajectory, planned losses while it is ahead.
  const pRetro = clamp(planWin ? 0.5 + RETRO_GAIN * gap : -RETRO_GAIN * gap, 0, 0.9);
  if (rng.chance(pRetro)) retroEntry(book, t, slDist, tpDist, retroMaxMin(persona), planWin);
  return t;
}

// A trade may be entered at a price of the recent past (up to 30% of the
// holding time, capped by style): the best one for a planned win, the worst
// one for a planned loss -- as long as neither level would have been touched
// since.
export const retroMaxMin = (persona) => ({ scalper: 60, day: 60, swing: 360, position: 1440 })[persona.style];

export function retroEntry(book, t, slDist, tpDist, maxMin, favourable) {
  const D = clamp(Math.round(t.holdMin * 0.3), 1, maxMin);
  const now = book.at(t.sym, t.openMs);
  let lo = Infinity, loMs = 0, hi = -Infinity, hiMs = 0;
  for (let m = t.openMs - D * MINUTE; m < t.openMs; m += MINUTE) {
    if (!marketOpen(t.sym, m)) continue;
    const p = book.at(t.sym, m);
    if (p < lo) [lo, loMs] = [p, m];
    if (p > hi) [hi, hiMs] = [p, m];
  }
  if (!loMs) return;
  const buyGain = now - lo;
  const sellGain = hi - now;
  // Favourable: buy at the low / sell at the high. Unfavourable: the reverse.
  const useLow = favourable ? buyGain >= sellGain : now - lo < hi - now;
  const dir = favourable ? (useLow ? 1 : -1) : useLow ? -1 : 1;
  const fromMs = useLow ? loMs : hiMs;
  const entry = roundTo(useLow ? lo : hi, SPECS[t.sym].dp);
  // Neither level may have been reached between that entry and now.
  for (let m = fromMs; m <= t.openMs; m += MINUTE) {
    if (!marketOpen(t.sym, m)) continue;
    const e = (book.at(t.sym, m) - entry) * dir;
    if (e >= tpDist || e <= -slDist) return;
  }
  Object.assign(t, {
    dir,
    side: dir > 0 ? "buy" : "sell",
    entry,
    sl: roundTo(entry - dir * slDist, SPECS[t.sym].dp),
    tp: roundTo(entry + dir * tpDist, SPECS[t.sym].dp),
    openMs: fromMs,
    holdMin: t.holdMin + Math.round((t.openMs - fromMs) / MINUTE),
  });
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
