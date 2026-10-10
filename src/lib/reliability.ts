// Distinct UTC calendar days with a trade opened or closed -- the same
// definition as provider_stats.active_days (public.refresh_provider_stats).
export function computeActiveTradingDays(signals: { opened_at: string; closed_at?: string | null }[]): number {
  const day = (iso: string) => iso.slice(0, 10);
  const days = new Set<string>();
  for (const s of signals) {
    days.add(day(new Date(s.opened_at).toISOString()));
    if (s.closed_at) days.add(day(new Date(s.closed_at).toISOString()));
  }
  return days.size;
}
