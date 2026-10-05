// Validation gate for a rebuilt leader: the generated history has to match
// its persona (win rate, reward:risk, drawdown, activity) and stay inside the
// risk class' daily / monthly limits. Failing leaders are regenerated with a
// new sub-seed by the rebuild script.

import { RISK_LIMITS } from "./personas.mjs";

const DAY_MS = 86400_000;

export function leaderMetrics(sim) {
  const closed = sim.trades.filter((t) => !t.stillOpen);
  const wins = closed.filter((t) => t.pnl > 0);
  const losses = closed.filter((t) => t.pnl <= 0);
  const avgWin = wins.length ? wins.reduce((a, t) => a + t.returnPct, 0) / wins.length : 0;
  const avgLoss = losses.length ? -losses.reduce((a, t) => a + t.returnPct, 0) / losses.length : 0;

  let log = 0;
  let peak = 0;
  let mdd = 0;
  let maxDay = 0;
  const months = new Map();
  for (const [k, r] of sim.daily) {
    const base = r.start + r.cash;
    const ret = base > 0 ? r.pnl / base : 0;
    maxDay = Math.max(maxDay, Math.abs(ret));
    log += Math.log(Math.max(1e-6, 1 + ret));
    peak = Math.max(peak, log);
    mdd = Math.max(mdd, 1 - Math.exp(log - peak));
    const d = new Date(k * DAY_MS);
    const mk = d.getUTCFullYear() * 12 + d.getUTCMonth();
    months.set(mk, (months.get(mk) ?? 0) + Math.log(Math.max(1e-6, 1 + ret)));
  }
  const monthRets = [...months.values()].map((l) => Math.exp(l) - 1);
  const days = sim.daily.length;
  const tradingDays = Math.max(1, sim.daily.filter(([, r]) => r.trades > 0).length);
  return {
    trades: closed.length,
    winRate: closed.length ? wins.length / closed.length : 0,
    rr: avgLoss > 0 ? avgWin / avgLoss : 0,
    mdd,
    maxDay,
    monthRets,
    total: Math.exp(log) - 1,
    annual: days > 30 ? Math.exp((log * 365) / days) - 1 : 0,
    tradesPerDay: closed.length / Math.max(1, days),
    tradesPerTradingDay: closed.length / tradingDays,
  };
}

export function validateLeader(persona, sim, trackDays) {
  const m = leaderMetrics(sim);
  const lim = RISK_LIMITS[persona.risk];
  const v = [];
  if (m.maxDay > lim.day * 1.05) v.push(`day ${(m.maxDay * 100).toFixed(1)}%`);
  let extremes = 0;
  for (const r of m.monthRets) {
    if (r < lim.month[0] * 1.05 || r > lim.month[1] * 1.05) v.push(`month ${(r * 100).toFixed(1)}%`);
    if (r < lim.monthNormal[0] * 1.05 || r > lim.monthNormal[1] * 1.05) extremes++;
  }
  const years = Math.max(1, trackDays / 365);
  if (persona.risk !== "high" && extremes > 0) v.push(`abnormal months ${extremes}`);
  if (persona.risk === "high" && extremes > Math.ceil(years) + 1) v.push(`extreme months ${extremes}`);
  if (m.mdd > persona.dd[1] * 1.15 + 0.01) v.push(`dd ${(m.mdd * 100).toFixed(1)}%`);
  if (m.trades >= 150) {
    const [lo, hi] = [persona.wr - 0.08, persona.wr + 0.08];
    if (m.winRate < lo || m.winRate > hi) v.push(`wr ${(m.winRate * 100).toFixed(1)}%`);
    if (m.rr < persona.rr * 0.65 || m.rr > persona.rr * 1.5) v.push(`rr ${m.rr.toFixed(2)}`);
  }
  return { ok: v.length === 0, violations: v, metrics: m };
}
