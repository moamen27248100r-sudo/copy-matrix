// The 13 simulated-leader personas. Every leader gets one persona; its concrete
// values are drawn inside the persona's ranges from a seed tied to the leader's
// id, and stored on providers.persona so the live engine (run_market_simulation)
// keeps trading exactly the same way the rebuilt history did.

export const PERSONA_VERSION = 3;

const MIN = 1;
const HOUR = 60;
const DAY = 24 * HOUR;

// Risk-class limits. Daily / monthly caps are enforced by the engine (it stops
// opening trades once a day or month is near the cap) and re-checked by the
// validation gate.
export const RISK_LIMITS = {
  low: { day: 0.03, monthNormal: [-0.06, 0.06], month: [-0.1, 0.1], dd: [0.05, 0.15] },
  medium: { day: 0.07, monthNormal: [-0.12, 0.15], month: [-0.2, 0.25], dd: [0.15, 0.3] },
  high: { day: 0.18, monthNormal: [-0.3, 0.4], month: [-0.45, 0.6], dd: [0.3, 0.6] },
};

// sessions: [startHourUtc, endHourUtc, weight]; weekend: may trade Sat/Sun
// (crypto only -- gold and forex never trade while their market is closed).
// tpd: trades per trading day; holds in minutes; risk in % of equity per trade;
// annual returns as simple %, e.g. [10, 20] = +10% to +20% a year.
export const PERSONAS = {
  gold_scalper: {
    n: 1, style: "scalper", risk: "low", tpd: [10, 25], hold: [2 * MIN, 20 * MIN],
    assets: { XAUUSD: 0.75, EURUSD: 0.25 }, sessions: [[7, 12, 1], [12, 17, 1.4]], weekend: false,
    riskPct: [0.15, 0.3], lev: [30, 50], wr: [0.62, 0.68], rr: [0.55, 0.7], dd: [0.06, 0.12],
    traj: { kind: "linear", annual: [10, 20] }, profitShare: [15, 20], capital: [5000, 30000],
    minCopy: [200, 300, 500], pop: [90, 320], maxOpen: 1, withdraw: [0.6, 0.3, 0.5], count: 48,
  },
  crypto_scalper: {
    n: 2, style: "scalper", risk: "high", tpd: [20, 40], hold: [1 * MIN, 15 * MIN],
    assets: { BTCUSDT: 0.4, ETHUSDT: 0.35, SOLUSDT: 0.25 }, sessions: [[0, 13, 0.6], [13, 21, 1.6], [21, 24, 0.8]], weekend: true,
    riskPct: [0.5, 0.8], lev: [50, 100], wr: [0.52, 0.57], rr: [0.85, 1.0], dd: [0.3, 0.5],
    traj: { kind: "choppy", annual: [-35, 70], amp: [0.12, 0.22], period: [45, 110] }, profitShare: [10],
    capital: [2000, 15000], minCopy: [100, 200], pop: [40, 220], maxOpen: 2, withdraw: [0.35, 0.2, 0.4], count: 32,
  },
  fx_day: {
    n: 3, style: "day", risk: "medium", tpd: [2, 5], hold: [30 * MIN, 6 * HOUR],
    assets: { EURUSD: 0.7, XAUUSD: 0.3 }, sessions: [[7, 12, 0.8], [12, 16, 1.6], [16, 18, 0.6]], weekend: false,
    riskPct: [0.5, 1.0], lev: [10, 30], wr: [0.5, 0.56], rr: [1.0, 1.3], dd: [0.15, 0.25],
    traj: { kind: "linear", annual: [8, 20] }, profitShare: [10, 15], capital: [3000, 25000],
    minCopy: [100, 200, 300], pop: [60, 360], maxOpen: 2, withdraw: [0.5, 0.25, 0.45], count: 86,
  },
  gold_momentum: {
    n: 4, style: "day", risk: "medium", tpd: [1, 4], hold: [1 * HOUR, 8 * HOUR],
    assets: { XAUUSD: 0.85, EURUSD: 0.15 }, sessions: [[12, 14, 1.8], [14, 19, 1]], weekend: false,
    riskPct: [1.0, 1.5], lev: [20, 50], wr: [0.44, 0.5], rr: [1.3, 1.7], dd: [0.2, 0.3],
    traj: { kind: "dip_or_linear", dipShare: 0.7, annual: [15, 35], dip: [0.1, 0.18] }, profitShare: [15, 20],
    capital: [3000, 20000], minCopy: [100, 200, 300], pop: [60, 380], maxOpen: 2, withdraw: [0.5, 0.25, 0.5], count: 63,
  },
  crypto_day: {
    n: 5, style: "day", risk: "medium", tpd: [2, 5], hold: [1 * HOUR, 12 * HOUR],
    assets: { BTCUSDT: 0.35, ETHUSDT: 0.3, BNBUSDT: 0.15, XRPUSDT: 0.2 }, sessions: [[0, 4, 1.3], [4, 13, 0.5], [13, 21, 1.4], [21, 24, 0.6]], weekend: true,
    riskPct: [0.75, 1.25], lev: [5, 20], wr: [0.48, 0.53], rr: [0.95, 1.1], dd: [0.15, 0.28],
    traj: { kind: "linear", annual: [-8, 8] }, profitShare: [5, 10], capital: [2000, 15000],
    minCopy: [100, 200], pop: [40, 200], maxOpen: 2, withdraw: [0.25, 0.2, 0.4], count: 79,
  },
  swing_trend: {
    n: 6, style: "swing", risk: "medium", tpd: [2 / 7, 6 / 7], hold: [2 * DAY, 10 * DAY],
    assets: { XAUUSD: 0.35, BTCUSDT: 0.25, ETHUSDT: 0.2, GBPUSD: 0.2 }, sessions: [[6, 20, 1]], weekend: false,
    riskPct: [1.0, 2.0], lev: [3, 10], wr: [0.45, 0.55], rr: [1.3, 1.9], dd: [0.15, 0.28],
    traj: { kind: "linear", annual: [20, 45] }, profitShare: [20, 25], capital: [5000, 50000],
    minCopy: [200, 300, 500], pop: [80, 450], maxOpen: 4, withdraw: [0.55, 0.25, 0.5], count: 79,
  },
  crypto_swing_bold: {
    n: 7, style: "swing", risk: "high", tpd: [1 / 7, 4 / 7], hold: [1 * DAY, 7 * DAY],
    assets: { SOLUSDT: 0.3, XRPUSDT: 0.25, ETHUSDT: 0.25, BNBUSDT: 0.2 }, sessions: [[0, 24, 1]], weekend: true,
    riskPct: [3, 5], lev: [10, 25], wr: [0.4, 0.48], rr: [1.5, 2.5], dd: [0.4, 0.6],
    traj: { kind: "boom_bust", peak: [120, 250], peakAt: [0.55, 0.75], drop: [0.4, 0.55], bustDays: [60, 120] },
    profitShare: [10, 15], capital: [2000, 20000], minCopy: [100, 200], pop: [50, 300], maxOpen: 3,
    withdraw: [0.4, 0.15, 0.35], minTrackMonths: 9, count: 48,
  },
  position_conservative: {
    n: 8, style: "position", risk: "low", tpd: [3 / 30, 8 / 30], hold: [14 * DAY, 56 * DAY],
    assets: { XAUUSD: 0.45, BTCUSDT: 0.25, EURUSD: 0.3 }, sessions: [[8, 16, 1]], weekend: false,
    riskPct: [0.8, 1.4], lev: [2, 5], wr: [0.55, 0.65], rr: [1.2, 2.0], dd: [0.05, 0.12],
    traj: { kind: "linear", annual: [5, 12] }, profitShare: [25, 30], capital: [20000, 150000],
    minCopy: [500, 1000], pop: [100, 600], maxOpen: 6, withdraw: [0.6, 0.3, 0.6], minTrackMonths: 9, count: 58,
  },
  macro: {
    n: 9, style: "position", risk: "low", tpd: [2 / 30, 5 / 30], hold: [21 * DAY, 90 * DAY],
    assets: { XAUUSD: 0.4, EURUSD: 0.25, GBPUSD: 0.2, USDJPY: 0.15 }, sessions: [[8, 16, 1]], weekend: false,
    riskPct: [0.6, 1.0], lev: [2, 5], wr: [0.52, 0.6], rr: [1.1, 1.6], dd: [0.06, 0.14],
    traj: { kind: "linear", annual: [2, 7] }, profitShare: [10, 15], capital: [20000, 120000],
    minCopy: [300, 500, 1000], pop: [50, 300], maxOpen: 5, withdraw: [0.4, 0.25, 0.5], minTrackMonths: 4, count: 42,
  },
  overtrader: {
    n: 10, style: "day", risk: "high", tpd: [3, 8], hold: [15 * MIN, 4 * HOUR],
    assets: { XAUUSD: 0.6, BTCUSDT: 0.4 }, sessions: [[7, 17, 1]], weekend: false,
    riskPct: [1.0, 1.5], lev: [20, 50], wr: [0.54, 0.6], rr: [0.65, 0.85], dd: [0.25, 0.45],
    traj: { kind: "linear", annual: [-35, -15] }, profitShare: [5], capital: [2000, 15000],
    minCopy: [50, 100, 200], pop: [30, 200], maxOpen: 3, withdraw: [0.1, 0.2, 0.4], count: 87,
  },
  gambler: {
    n: 11, style: "day", risk: "high", tpd: [1, 4], hold: [30 * MIN, 24 * HOUR],
    assets: { BTCUSDT: 0.4, SOLUSDT: 0.3, XAUUSD: 0.3 }, sessions: [[0, 24, 1]], weekend: true,
    riskPct: [2.5, 4.0], lev: [50, 100], wr: [0.42, 0.5], rr: [0.9, 1.2], dd: [0.45, 0.6],
    traj: { kind: "crash", annual: [-60, -30], shocks: [1, 3], shock: [0.25, 0.4] }, profitShare: [5],
    capital: [1000, 8000], minCopy: [50, 100], pop: [20, 160], maxOpen: 3, withdraw: [0.05, 0.2, 0.4], count: 34,
  },
  recovery: {
    n: 12, style: "day", risk: "medium", tpd: [1, 3], hold: [2 * HOUR, 3 * DAY],
    assets: { XAUUSD: 0.45, ETHUSDT: 0.3, EURUSD: 0.25 }, sessions: [[7, 17, 1]], weekend: false,
    riskPct: [1.0, 1.5], lev: [10, 30], wr: [0.46, 0.54], rr: [1.1, 1.5], dd: [0.2, 0.3],
    traj: { kind: "recovery", down: [0.15, 0.25], annual: [25, 45] }, profitShare: [15, 20],
    capital: [3000, 25000], minCopy: [100, 200, 300], pop: [60, 360], maxOpen: 3, withdraw: [0.4, 0.25, 0.45],
    minTrackMonths: 9, count: 53,
  },
  choppy: {
    n: 13, style: "day", risk: "high", tpd: [2, 6], hold: [1 * HOUR, 2 * DAY],
    assets: { XAUUSD: 0.3, BTCUSDT: 0.25, ETHUSDT: 0.15, EURUSD: 0.15, SOLUSDT: 0.15 }, sessions: [[6, 22, 1]], weekend: false,
    riskPct: [2.0, 3.0], lev: [20, 50], wr: [0.46, 0.52], rr: [1.0, 1.2], dd: [0.3, 0.45],
    traj: { kind: "choppy", annual: [-6, 6], amp: [0.18, 0.28], period: [60, 150] }, profitShare: [5, 10],
    capital: [2000, 15000], minCopy: [100, 200], pop: [30, 200], maxOpen: 3, withdraw: [0.25, 0.2, 0.4], count: 41,
  },
};

export const PERSONA_KEYS = Object.keys(PERSONAS);

// Average copy size per follower, by risk class (AUM = followers x this).
const COPY_AVG = { low: [1200, 3000], medium: [500, 1500], high: [250, 800] };

const lnAnnual = (pct) => Math.log(1 + pct / 100);
const T_MAX_SHOCK = 0.4;

// Momentum lookback (minutes) the direction is read from, by style. The live
// engine reads it from price_history, which keeps 7 days.
const LOOKBACK = { scalper: [10, 60], day: [60, 480], swing: [720, 2880], position: [2880, 7200] };

// Stop distance in units of the volatility expected over the holding time.
const K_SL = { scalper: [1.6, 2.2], day: [1.3, 1.8], swing: [0.6, 0.9], position: [0.55, 0.85] };

// Concrete persona for one leader. `startMs` is the leader's join date and
// `trackDays` the length of the history being built (it places the boom/bust
// peak and the recovery trough inside the history).
export function drawPersona(key, rng, { startMs, trackDays }) {
  const P = PERSONAS[key];
  const r = (pair) => rng.range(pair[0], pair[1]);
  // Scalpers trade at the lower end of their range more often.
  const tpd = P.style === "scalper" ? P.tpd[0] + (P.tpd[1] - P.tpd[0]) * rng.float() ** 1.6 : r(P.tpd);
  const traj = drawTrajectory(P.traj, rng, trackDays);
  // Losing and choppy curves level off before they would break the persona's
  // drawdown range (the wave and the temporary part of a crash count too).
  if (traj.kind === "choppy" || traj.kind === "crash" || (traj.kind === "linear" && traj.a < 0)) {
    const swing = 2 * (traj.amp ?? 0) + (traj.kind === "crash" ? 0.6 * Math.abs(Math.log(1 - T_MAX_SHOCK)) : 0);
    traj.floor = round(Math.min(0, Math.log(1 - 0.85 * P.dd[1]) + swing), 5);
  }
  const [wdProb, wdLo, wdHi] = P.withdraw;
  return {
    v: PERSONA_VERSION,
    key,
    n: P.n,
    style: P.style,
    risk: P.risk,
    tpd: round(tpd, 4),
    hold: [P.hold[0], P.hold[1]],
    assets: P.assets,
    sessions: P.sessions,
    weekend: P.weekend,
    risk_pct: round(r(P.riskPct), 3),
    lev: Math.round(r(P.lev)),
    wr: round(r(P.wr), 3),
    rr: round(r(P.rr), 3),
    k_sl: round(rng.range(...K_SL[P.style]), 3),
    // Strategy: follow (trend) or fade (reversion) the move over `lb` minutes,
    // with probability `follow`; otherwise the direction is a coin flip.
    strat: rng.chance(0.6) ? "trend" : "reversion",
    lb: Math.round(Math.exp(rng.range(Math.log(LOOKBACK[P.style][0]), Math.log(LOOKBACK[P.style][1])))),
    follow: round(rng.range(0.5, 0.85), 3),
    dd: P.dd,
    traj,
    start: new Date(startMs).toISOString(),
    cap0: Math.round(r(P.capital) / 100) * 100,
    pop: Math.round(r(P.pop)),
    copy_avg: Math.round(r(COPY_AVG[P.risk])),
    wd_prob: wdProb,
    wd_frac: round(rng.range(wdLo, wdHi), 3),
    max_open: P.maxOpen,
    min_copy: rng.pick(P.minCopy),
    seed: Math.floor(rng.float() * 2 ** 31),
  };
}

function drawTrajectory(T, rng, trackDays) {
  const r = (pair) => rng.range(pair[0], pair[1]);
  switch (T.kind) {
    case "linear":
      return { kind: "linear", a: round(lnAnnual(r(T.annual)), 5) };
    case "dip_or_linear":
      if (rng.chance(T.dipShare) && trackDays > 120) {
        const q = Math.round(trackDays * rng.range(0.3, 0.5));
        return { kind: "recovery", q, a1: round(Math.log(1 - r(T.dip)) * (365 / q), 5), a2: round(lnAnnual(r(T.annual)) * 1.15, 5) };
      }
      return { kind: "linear", a: round(lnAnnual(r(T.annual)), 5) };
    case "choppy":
      return {
        kind: "choppy",
        a: round(lnAnnual(r(T.annual)), 5),
        amp: round(Math.log(1 + r(T.amp)), 5),
        period: Math.round(r(T.period)),
        phase: round(rng.range(0, 2 * Math.PI), 4),
      };
    case "boom_bust": {
      const p = Math.max(90, Math.round(trackDays * r(T.peakAt)));
      const bust = Math.round(r(T.bustDays));
      return {
        kind: "boom_bust",
        p,
        a1: round(Math.log(1 + r(T.peak) / 100) * (365 / p), 5),
        b: bust,
        drop: round(Math.log(1 - r(T.drop)), 5),
        a3: round(lnAnnual(rng.range(-3, 8)), 5),
      };
    }
    case "crash": {
      const shocks = [];
      const perYear = rng.range(T.shocks[0], T.shocks[1]);
      const n = Math.max(1, Math.round((perYear * trackDays) / 365));
      for (let i = 0; i < n; i++) shocks.push([Math.round(rng.range(0.1, 0.95) * Math.max(30, trackDays)), round(Math.log(1 - r(T.shock)), 5)]);
      shocks.sort((a, b) => a[0] - b[0]);
      return {
        kind: "crash",
        a: round(lnAnnual(r(T.annual)), 5),
        shocks,
        every: round(365 / perYear, 1),
        extra: round(Math.log(1 - (T.shock[0] + T.shock[1]) / 2), 5),
        amp: round(Math.log(1 + rng.range(0.06, 0.12)), 5),
        period: Math.round(rng.range(40, 90)),
        phase: round(rng.range(0, 2 * Math.PI), 4),
      };
    }
    case "recovery": {
      const q = Math.min(365, Math.round(trackDays * rng.range(0.35, 0.5)));
      return { kind: "recovery", q, a1: round(Math.log(1 - r(T.down)) * (365 / q), 5), a2: round(lnAnnual(r(T.annual)), 5) };
    }
    default:
      throw new Error(`unknown trajectory ${T.kind}`);
  }
}

// Target log-return of the leader's time-weighted equity index `d` days after
// joining. Mirrored in SQL by public.sim_target_log (keep the two identical).
export function targetLog(traj, d) {
  return Math.max(rawTargetLog(traj, d), traj.floor ?? -Infinity) + wave(traj, d);
}

// The shocks of a crash curve: the drawn ones, then (after the history) one of
// average size every `every` days.
function crashShocks(traj, d) {
  const out = traj.shocks.filter(([day]) => day < d);
  const last = traj.shocks.length ? traj.shocks[traj.shocks.length - 1][0] : 0;
  for (let day = last + traj.every; day < d; day += traj.every) out.push([day, traj.extra]);
  return out;
}

// The recoverable 60% of each crash: drops over 5 days, back over 45.
function crashDips(traj, d) {
  let v = 0;
  for (const [day, size] of crashShocks(traj, d)) {
    const x = d - day;
    v += 0.6 * size * Math.min(1, x / 5) * (1 - Math.min(1, Math.max(0, (x - 5) / 45)));
  }
  return v;
}

// Choppy and gambler curves swing around their drift.
function wave(traj, d) {
  if (traj.kind === "crash") return crashDips(traj, d) + sine(traj, d);
  return sine(traj, d);
}

function sine(traj, d) {
  return traj.amp ? traj.amp * Math.sin((2 * Math.PI * d) / traj.period + traj.phase) - traj.amp * Math.sin(traj.phase) : 0;
}

function rawTargetLog(traj, d) {
  switch (traj.kind) {
    case "linear":
      return (traj.a * d) / 365;
    case "choppy":
      return (traj.a * d) / 365;
    case "boom_bust":
      if (d < traj.p) return (traj.a1 * d) / 365;
      if (d < traj.p + traj.b) return (traj.a1 * traj.p) / 365 + (traj.drop * (d - traj.p)) / traj.b;
      return (traj.a1 * traj.p) / 365 + traj.drop + (traj.a3 * (d - traj.p - traj.b)) / 365;
    case "crash": {
      // 40% of each shock is a lasting loss; the rest (see crashDips) is won
      // back over the following weeks.
      let v = (traj.a * d) / 365;
      for (const [day, size] of crashShocks(traj, d)) v += 0.4 * size * Math.min(1, Math.max(0, (d - day) / 5));
      return v;
    }
    case "recovery":
      return d < traj.q ? (traj.a1 * d) / 365 : (traj.a1 * traj.q) / 365 + (traj.a2 * (d - traj.q)) / 365;
    default:
      return 0;
  }
}

function round(x, n) {
  const f = 10 ** n;
  return Math.round(x * f) / f;
}

// One candidate way of trading for an existing leader: the profile stays as it
// is (style, risk class, assets, sessions, activity, holding times, capital,
// audience, target curve) and only the trading parameters inside the
// persona's ranges are drawn again -- risk per trade, leverage, reward:risk,
// stop width and the strategy.
export function candidatePersona(profile, rng) {
  const P = PERSONAS[profile.key];
  const r = (pair) => rng.range(pair[0], pair[1]);
  return {
    ...profile,
    v: PERSONA_VERSION,
    risk_pct: round(r(P.riskPct), 3),
    lev: Math.round(r(P.lev)),
    rr: round(r(P.rr), 3),
    k_sl: round(rng.range(...K_SL[P.style]), 3),
    ...drawStrategy(P.style, rng),
    seed: Math.floor(rng.float() * 2 ** 31),
  };
}

// The trend lookback is read from price_history live (7 days kept), so it stays under 6.25 days.
export const MAX_TREND_LOOKBACK = 9000;

// Strategy of a candidate: trend (buy pullbacks in the trend), breakout (go with
// a move the trend confirms) or reversion (fade an over-extended move), a short
// lookback by style, a trend lookback 3-8 times longer, and how systematically
// the leader follows it.
function drawStrategy(style, rng) {
  const lb = Math.round(Math.exp(rng.range(Math.log(LOOKBACK[style][0]), Math.log(LOOKBACK[style][1]))));
  return {
    strat: rng.weighted({ trend: 0.45, breakout: 0.3, reversion: 0.25 }),
    lb,
    tlb: Math.min(MAX_TREND_LOOKBACK, Math.round(lb * rng.range(3, 8))),
    follow: round(rng.range(0.6, 0.95), 3),
  };
}
