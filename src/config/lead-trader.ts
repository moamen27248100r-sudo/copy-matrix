// Lead Trader system config -- see LEADER_TASKS.md for the phased plan.

// Master switch for every feature that moves real money (profit-share
// deduction/settlement, Phase 5). Off by default: the whole profit-share
// pipeline stays inert until this is flipped on, and even then only ever runs
// on demo accounts (checked alongside this flag everywhere it matters).
export const LEAD_TRADER_MONEY_ENABLED = false;

// The four tiers (Phase 7). Computed/checked in application code against a
// trader's own live stats (see provider_performance / provider_cards) rather
// than stored per-provider, the same way provider_cards already computes
// `tier` on the fly -- so upgrades are automatic and there is nothing to
// keep in sync.
export type LeadTraderTierKey = "beginner" | "bronze" | "silver" | "gold";

export type LeadTraderTier = {
  key: LeadTraderTierKey;
  labelAr: string;
  maxFollowers: number;
  maxProfitSharePct: number;
  minActiveDays: number;
  minAum: number;
  minFollowerProfit: number;
  maxDrawdownPct: number;
};

export const LEAD_TRADER_TIERS: LeadTraderTier[] = [
  { key: "beginner", labelAr: "مبتدئ", maxFollowers: 10, maxProfitSharePct: 0, minActiveDays: 0, minAum: 0, minFollowerProfit: 0, maxDrawdownPct: 100 },
  { key: "bronze", labelAr: "برونزي", maxFollowers: 30, maxProfitSharePct: 15, minActiveDays: 14, minAum: 1000, minFollowerProfit: 0, maxDrawdownPct: 40 },
  { key: "silver", labelAr: "فضي", maxFollowers: 75, maxProfitSharePct: 30, minActiveDays: 45, minAum: 10000, minFollowerProfit: 500, maxDrawdownPct: 30 },
  { key: "gold", labelAr: "ذهبي", maxFollowers: 200, maxProfitSharePct: 50, minActiveDays: 90, minAum: 50000, minFollowerProfit: 5000, maxDrawdownPct: 20 },
];

export function tierByKey(key: string | null | undefined): LeadTraderTier {
  return LEAD_TRADER_TIERS.find((t) => t.key === key) ?? LEAD_TRADER_TIERS[0];
}

// Options offered on the application form / settings page.
export const LEAD_TRADER_MARKETS = ["crypto", "forex", "gold", "indices"] as const;
export const LEAD_TRADER_STYLES = ["scalper", "session_trader", "moderate", "sporadic"] as const;

export const LEAD_TRADER_MIN_INVESTMENT_DEFAULT = 100;
export const FOLLOWER_REMOVALS_PER_DAY_MAX = 10;
