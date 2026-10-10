import type { SupabaseClient } from "@supabase/supabase-js";
import { LEAD_TRADER_TIERS, type LeadTraderTier } from "@/config/lead-trader";

// The provider row for a signed-in lead trader, or null if they don't have
// one (not approved yet). One provider per user (providers.user_id unique).
export async function getOwnProviderId(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await supabase.from("providers").select("id").eq("user_id", userId).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export type FollowerRow = {
  id: string;
  follower_id: string;
  allocated_amount: number;
  is_active: boolean;
  copy_started_at: string | null;
  max_drawdown_pct: number;
};

export type FollowerPositionRow = {
  id: string;
  subscription_id: string;
  status: string;
  pnl: number | null;
  entry_price: number;
  size: number;
  opened_at: string;
  closed_at: string | null;
  signals: { symbol: string; side: string } | { symbol: string; side: string }[] | null;
};

// Picks the current tier from a lead trader's own live stats -- the same
// "compute on the fly from real numbers" approach provider_cards already
// uses for its `tier` column, so there's nothing to keep in sync (Phase 7).
export function currentTier(stats: {
  activeDays: number;
  aum: number;
  followerProfit: number;
  maxDrawdownPct: number | null;
}): LeadTraderTier {
  let best = LEAD_TRADER_TIERS[0];
  for (const tier of LEAD_TRADER_TIERS) {
    const meets =
      stats.activeDays >= tier.minActiveDays &&
      stats.aum >= tier.minAum &&
      stats.followerProfit >= tier.minFollowerProfit &&
      (stats.maxDrawdownPct == null || stats.maxDrawdownPct <= tier.maxDrawdownPct);
    if (meets) best = tier;
  }
  return best;
}

export function nextTier(current: LeadTraderTier): LeadTraderTier | null {
  const i = LEAD_TRADER_TIERS.findIndex((t) => t.key === current.key);
  return i >= 0 && i < LEAD_TRADER_TIERS.length - 1 ? LEAD_TRADER_TIERS[i + 1] : null;
}
