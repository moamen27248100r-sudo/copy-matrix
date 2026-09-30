import type { SupabaseClient } from "@supabase/supabase-js";

export type LeadOverview = {
  aum: number;
  followers_total: number;
  followers_active: number;
  followers_new_month: number;
  followers_stopped: number;
  earnings_month: number;
  earnings_total: number;
  earnings_pending: number;
};

export type LeadPerformance = {
  roi: number;
  max_drawdown: number;
  win_rate: number | null;
  trades: number;
  avg_duration_hours: number | null;
  risk_score: number | null;
  curve: { t: string; v: number }[];
  monthly: { month: string; ret: number; trades: number }[];
};

// All numbers come from SECURITY DEFINER functions (0210) that resolve the
// caller's own provider server-side; nothing is computed in the browser.
export async function fetchLeadOverview(supabase: SupabaseClient): Promise<LeadOverview | null> {
  const { data } = await supabase.rpc("lead_dashboard_overview");
  return (data as LeadOverview | null) ?? null;
}

export async function fetchLeadPerformance(supabase: SupabaseClient, days: number | null): Promise<LeadPerformance | null> {
  const { data } = await supabase.rpc("lead_dashboard_performance", { p_days: days });
  return (data as LeadPerformance | null) ?? null;
}

export const PERFORMANCE_RANGES = [
  { key: "1m", days: 30 },
  { key: "3m", days: 90 },
  { key: "6m", days: 180 },
  { key: "1y", days: 365 },
  { key: "all", days: null },
] as const;
