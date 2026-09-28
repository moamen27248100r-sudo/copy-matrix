import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { INTERNATIONAL_COUNTRY_CODES } from "@/lib/country-metadata";

export type LandingTrader = {
  id: string;
  name: string;
  country: string | null;
  symbol: string | null;
  followers: number;
  trades: number;
  ret: number; // 12-month return, % (sum of trade returns)
  dd: number; // max drawdown, %
  risk: number; // 1-10, derived from max drawdown
  series: number[]; // cumulative % at each month end
  minCopy: number;
};

export type LandingTraders = {
  followers: LandingTrader[];
  risk: LandingTrader[];
  return: LandingTrader[];
};

// Arabic-named leaders sit in these countries (MA is left out: it also holds
// Latin-named international identities, see country-metadata.ts); every other locale shows the
// international roster (same split the homepage used before).
const ARAB_COUNTRY_CODES = [
  "SA", "EG", "AE", "KW", "QA", "BH", "OM", "JO", "LB", "IQ", "DZ", "TN", "LY", "SD", "YE", "PS", "SY", "MR", "SO", "DJ",
];

// Risk score 1-10: one point per 3 percentage points of max drawdown (12 months).
export function riskScore(dd: number) {
  return Math.min(10, Math.max(1, Math.ceil(dd / 3)));
}

async function fetchLandingTraders(arabic: boolean): Promise<LandingTraders> {
  // Public, identical for every visitor, so it sits in the shared cache. The
  // service-role client is used because the scan over a year of signals can take
  // several seconds, longer than the anon role's 3s statement timeout; the SQL
  // function (0197) is read-only and only ever returns aggregates.
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("landing_top_traders", {
    p_days: 365,
    p_min_trades: 30,
    p_countries: arabic ? ARAB_COUNTRY_CODES : INTERNATIONAL_COUNTRY_CODES,
    p_limit: 9,
    p_max_return: 150,
  });
  // Throw (rather than return an empty list) so a failed call is never cached.
  if (error || !data) throw new Error(`landing_top_traders failed: ${error?.message ?? "no data"}`);

  const map = data.traders as Record<
    string,
    { name: string; country: string | null; symbol: string | null; followers: number; trades: number; ret: number; dd: number; series: number[]; minCopy: number }
  >;
  // The SQL "followers" figure includes the seeded base_followers_count, which
  // must not be shown. Replace it with the real copier count from the
  // provider_followers view (read only) and re-rank the most-copied tab by it.
  const { data: real } = await supabase
    .from("provider_followers")
    .select("provider_id, followers_count")
    .in("provider_id", Object.keys(map));
  const realCount = new Map((real ?? []).map((r) => [String(r.provider_id), Number(r.followers_count)]));
  const build = (ids: string[]): LandingTrader[] =>
    ids.flatMap((id) => {
      const x = map[id];
      if (!x) return [];
      return [{ id, ...x, followers: realCount.get(id) ?? 0, ret: Number(x.ret), dd: Number(x.dd), risk: riskScore(Number(x.dd)), minCopy: Number(x.minCopy) }];
    });
  return {
    followers: build(data.followers).sort((a, b) => b.followers - a.followers),
    risk: build(data.risk),
    return: build(data.return),
  };
}

export const getLandingTraders = async (arabic: boolean): Promise<LandingTraders> => {
  try {
    return await unstable_cache(() => fetchLandingTraders(arabic), ["landing-traders-v4", arabic ? "ar" : "intl"], {
      revalidate: 3600,
    })();
  } catch (e) {
    console.error(e);
    return { followers: [], risk: [], return: [] };
  }
};

// Lowest minimum copy amount across active traders, for the facts strip.
async function fetchMinCopy(): Promise<number | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data } = await supabase
    .from("provider_cards")
    .select("min_copy_amount")
    .eq("is_archived", false)
    .neq("trading_status", "stopped")
    .order("min_copy_amount", { ascending: true })
    .limit(1);
  const v = data?.[0]?.min_copy_amount;
  return v != null ? Number(v) : null;
}

export const getMinCopyAmount = () => unstable_cache(fetchMinCopy, ["landing-min-copy"], { revalidate: 3600 })();
