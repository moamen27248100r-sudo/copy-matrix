import type { SupabaseClient } from "@supabase/supabase-js";

export type ProviderStats = {
  trades: number;
  winRate: number | null;
  totalReturn: number;
  maxDrawdown: number | null;
  sharpe: number | null;
  avgDurationHours: number | null;
};

type ClosedSignal = {
  provider_id: string;
  side: string;
  entry_price: number;
  exit_price: number;
  opened_at: string;
  closed_at: string;
};

const PAGE = 1000;
const MAX_PAGES = 40;

// Per-provider stats computed from closed public signals (created_by_admin
// signals are per-customer corrections and excluded, same as the trader page).
// `days` limits to trades closed within that window. Only called when a
// discover request actually needs these numbers.
export async function fetchProviderStats(
  supabase: SupabaseClient,
  providerIds: string[],
  days?: number,
): Promise<Map<string, ProviderStats>> {
  const rows: ClosedSignal[] = [];
  const cutoff = days ? new Date(Date.now() - days * 86400000).toISOString() : null;
  for (let i = 0; i < providerIds.length; i += 100) {
    const chunk = providerIds.slice(i, i + 100);
    for (let page = 0; page < MAX_PAGES; page++) {
      let q = supabase
        .from("signals")
        .select("provider_id, side, entry_price, exit_price, opened_at, closed_at")
        .in("provider_id", chunk)
        .eq("created_by_admin", false)
        .eq("status", "closed")
        .not("exit_price", "is", null)
        .not("closed_at", "is", null)
        .order("closed_at", { ascending: true })
        .range(page * PAGE, page * PAGE + PAGE - 1);
      if (cutoff) q = q.gte("closed_at", cutoff);
      const { data } = await q;
      if (!data || data.length === 0) break;
      rows.push(...(data as ClosedSignal[]));
      if (data.length < PAGE) break;
    }
  }

  const byProvider = new Map<string, ClosedSignal[]>();
  for (const r of rows) {
    const list = byProvider.get(r.provider_id);
    if (list) list.push(r);
    else byProvider.set(r.provider_id, [r]);
  }
  const out = new Map<string, ProviderStats>();
  for (const [id, list] of byProvider) out.set(id, computeStats(list));
  return out;
}

export function computeStats(signals: ClosedSignal[]): ProviderStats {
  const sorted = [...signals].sort((a, b) => new Date(a.closed_at).getTime() - new Date(b.closed_at).getTime());
  let equity = 1;
  let peak = 1;
  let maxDd = 0;
  let wins = 0;
  let total = 0;
  let durationMs = 0;
  const returns: number[] = [];
  for (const s of sorted) {
    const raw = (Number(s.exit_price) - Number(s.entry_price)) / Number(s.entry_price);
    const signed = s.side === "sell" ? -raw : raw;
    returns.push(signed);
    if (signed > 0) wins++;
    total += signed * 100;
    equity *= 1 + signed;
    if (equity > peak) peak = equity;
    const dd = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
    if (dd > maxDd) maxDd = dd;
    durationMs += Math.max(0, new Date(s.closed_at).getTime() - new Date(s.opened_at).getTime());
  }
  const n = sorted.length;
  let sharpe: number | null = null;
  if (n >= 2) {
    const mean = returns.reduce((a, b) => a + b, 0) / n;
    const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
    const sd = Math.sqrt(variance);
    // Per-trade Sharpe (risk-free rate 0), not annualized.
    sharpe = sd > 0 ? Math.round((mean / sd) * 100) / 100 : null;
  }
  return {
    trades: n,
    winRate: n ? Math.round((wins / n) * 100) : null,
    totalReturn: Math.round(total * 100) / 100,
    maxDrawdown: n ? Math.round(maxDd * 100) / 100 : null,
    sharpe,
    avgDurationHours: n ? Math.round((durationMs / n / 3600000) * 10) / 10 : null,
  };
}

// Bulk variant for the discover page: computed in the database
// (provider_period_stats, 0196, returns one jsonb map) instead of paging every
// signal through the API.
export async function fetchBulkProviderStats(
  supabase: SupabaseClient,
  days?: number,
): Promise<Map<string, ProviderStats>> {
  const out = new Map<string, ProviderStats>();
  const { data } = await supabase.rpc("provider_period_stats", { p_days: days ?? null });
  const map = (data ?? {}) as Record<
    string,
    { trades: number; win_rate: number | string; total_return: number | string; max_drawdown: number | string }
  >;
  for (const [id, r] of Object.entries(map)) {
    out.set(id, {
      trades: r.trades,
      winRate: Number(r.win_rate),
      totalReturn: Number(r.total_return),
      maxDrawdown: Number(r.max_drawdown),
      sharpe: null,
      avgDurationHours: null,
    });
  }
  return out;
}
