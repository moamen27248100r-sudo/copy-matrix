export type ReliabilitySignal = {
  side: string;
  entry_price: number;
  exit_price: number | null;
  status: string;
  opened_at: string;
  closed_at: string | null;
  close_trigger: string | null;
};

export type ReliabilityPoint = {
  date: string;
  reliability: number;
  safety: number;
  risk: number;
  limitScore: number;
};

// Replays a trader's real closed trades in chronological order (same
// running-equity approach as computeMaxDrawdown / TraderEquityChart) to
// derive a reliability score AT EACH POINT IN TIME, instead of only a
// single current snapshot. Each of the three inputs is itself grounded in
// real trade outcomes: win rate (performance), a volatility-derived
// safety score, and a drawdown-derived risk score -- the same formulas
// already used for the current-value gauges, just recomputed
// incrementally so the trend line is real history, not fabricated noise.
export function computeReliabilityTimeline(signals: ReliabilitySignal[]): ReliabilityPoint[] {
  const closed = signals
    .filter((s) => s.status === "closed" && s.exit_price != null && s.closed_at)
    .sort((a, b) => new Date(a.closed_at!).getTime() - new Date(b.closed_at!).getTime());

  const points: ReliabilityPoint[] = [];
  let equity = 1;
  let peak = 1;
  let wins = 0;
  let sumPct = 0;
  let sumPctSq = 0;
  let limitAdherent = 0;

  closed.forEach((s, i) => {
    const raw = (s.exit_price! - s.entry_price) / s.entry_price;
    const pct = (s.side === "sell" ? -raw : raw) * 100;
    equity *= 1 + pct / 100;
    if (equity > peak) peak = equity;
    const drawdownPct = peak > 0 ? ((peak - equity) / peak) * 100 : 0;

    if (pct > 0) wins += 1;
    sumPct += pct;
    sumPctSq += pct * pct;
    if (s.close_trigger === "tp" || s.close_trigger === "sl") limitAdherent += 1;

    const n = i + 1;
    const mean = sumPct / n;
    const variance = Math.max(0, sumPctSq / n - mean * mean);
    const stdev = Math.sqrt(variance);

    const winRate = (wins / n) * 100;
    const safety = Math.max(0, Math.min(100, Math.round(100 - stdev * 15)));
    const risk = Math.max(0, Math.min(100, Math.round(drawdownPct * 8)));
    const limitScore = Math.round((limitAdherent / n) * 100);
    const reliability = Math.max(
      0,
      Math.min(100, Math.round(winRate * 0.5 + safety * 0.3 + limitScore * 0.2)),
    );

    points.push({ date: s.closed_at!, reliability, safety, risk, limitScore });
  });

  return points;
}

// Distinct UTC calendar days the trader opened at least one position --
// a real activity count from the same signals data, not a synthetic
// "days as member" tenure figure.
export function computeActiveTradingDays(signals: { opened_at: string }[]): number {
  const days = new Set(
    signals.map((s) => {
      const d = new Date(s.opened_at);
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    }),
  );
  return days.size;
}
