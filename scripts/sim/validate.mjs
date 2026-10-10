// Picks a leader's history among several candidate runs. Every candidate is a
// complete, causal run of the engine (no trade looks ahead); the one whose
// equity curve sits closest to the leader's profile -- its target curve,
// drawdown range and win rate -- is kept. Nothing inside a run is adjusted.

import { RISK_LIMITS, targetLog } from "./personas.mjs";

const DAY_MS = 86400_000;

export function leaderMetrics(sim) {
  const closed = sim.trades.filter((t) => !t.stillOpen);
  const wins = closed.filter((t) => t.pnl > 0);
  let log = 0;
  let peak = 0;
  let mdd = 0;
  let maxDay = 0;
  const curve = [];
  const months = new Map();
  for (const [k, r] of sim.daily) {
    const base = r.start + r.cash;
    const ret = base > 0 ? r.pnl / base : 0;
    maxDay = Math.max(maxDay, Math.abs(ret));
    log += Math.log(Math.max(1e-6, 1 + ret));
    peak = Math.max(peak, log);
    mdd = Math.max(mdd, 1 - Math.exp(log - peak));
    curve.push([k, log]);
    const d = new Date(k * DAY_MS);
    const mk = d.getUTCFullYear() * 12 + d.getUTCMonth();
    months.set(mk, (months.get(mk) ?? 0) + Math.log(Math.max(1e-6, 1 + ret)));
  }
  const days = sim.daily.length;
  return {
    trades: closed.length,
    open: sim.trades.length - closed.length,
    winRate: closed.length ? wins.length / closed.length : 0,
    mdd,
    maxDay,
    monthRets: [...months.values()].map((l) => Math.exp(l) - 1),
    total: Math.exp(log) - 1,
    annual: days > 30 ? Math.exp((log * 365) / days) - 1 : 0,
    curve,
  };
}

// Lower is closer. RMS distance between the run's log equity index and the
// target curve at 12 checkpoints, plus drawdown / win-rate / risk-limit terms.
export function scoreCandidate(persona, sim, startMs) {
  const m = leaderMetrics(sim);
  const startDay = Math.floor(startMs / DAY_MS);
  let se = 0;
  let n = 0;
  const step = Math.max(1, Math.floor(m.curve.length / 12));
  for (let j = step - 1; j < m.curve.length; j += step) {
    const [k, log] = m.curve[j];
    se += (log - targetLog(persona.traj, k - startDay)) ** 2;
    n++;
  }
  const last = m.curve[m.curve.length - 1];
  if (last) {
    se += 2 * (last[1] - targetLog(persona.traj, last[0] - startDay)) ** 2;
    n += 2;
  }
  let score = n ? Math.sqrt(se / n) : 0;
  const [ddLo, ddHi] = persona.dd;
  score += 2 * Math.max(0, m.mdd - ddHi * 1.15) + 0.5 * Math.max(0, ddLo * 0.5 - m.mdd);
  if (m.trades >= 100) score += 0.5 * Math.max(0, Math.abs(m.winRate - persona.wr) - 0.05);
  const lim = RISK_LIMITS[persona.risk];
  if (m.maxDay > lim.day * 1.05) score += 0.5;
  return { score, metrics: m };
}
