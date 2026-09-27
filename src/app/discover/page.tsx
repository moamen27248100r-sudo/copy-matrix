import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { unfollowProvider, followTrader, unfollowTrader } from "@/app/discover/actions";
import { AppNav } from "@/components/AppNav";
import { LeaderCard } from "@/components/LeaderCard";
import { DiscoverFilterSheet } from "@/components/DiscoverFilterSheet";

const SORT_OPTIONS = {
  best: { column: "rating_score", ascending: false, labelKey: "sortBest" },
  return: { column: "avg_daily_return_pct", ascending: false, labelKey: "sortReturn" },
  winrate: { column: "win_rate_pct", ascending: false, labelKey: "sortWinrate" },
  followers: { column: "followers_count", ascending: false, labelKey: "sortFollowers" },
} as const;

type SortKey = keyof typeof SORT_OPTIONS;

// "Matrix Quick Focus" pills -- a different axis than SORT_OPTIONS (theme
// vs raw column sort), so both coexist. "roi"/"trusted" reuse an existing
// sort under the hood instead of duplicating that logic.
const PILL_KEYS = ["safe", "consistent", "rising", "roi", "trusted"] as const;
type PillKey = (typeof PILL_KEYS)[number];
const PILL_LABEL_KEYS: Record<PillKey, string> = {
  safe: "pillSafe",
  consistent: "pillConsistent",
  rising: "pillRising",
  roi: "pillRoi",
  trusted: "pillTrusted",
};

const ASSET_GROUPS: Record<string, string[]> = {
  gold: ["XAUUSD", "US30"],
  crypto: ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"],
  forex: ["EURUSD", "GBPUSD", "USDJPY"],
};
const RISK_VALUES = ["منخفضة", "متوسطة", "مرتفعة"] as const;

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    sort?: string;
    error?: string;
    pill?: string;
    risk?: string;
    minEntry?: string;
    assetClass?: string;
    trackRecord?: string;
  }>;
}) {
  const { q, sort, error, pill, risk, minEntry, assetClass, trackRecord } = await searchParams;
  const pillKey = pill && (PILL_KEYS as readonly string[]).includes(pill) ? (pill as PillKey) : null;
  // "roi"/"trusted" pills force their matching sort; an explicit ?sort=
  // still wins if the customer also picked one directly.
  const effectiveSort = sort && sort in SORT_OPTIONS ? sort : pillKey === "roi" ? "return" : pillKey === "trusted" ? "followers" : undefined;
  const sortKey: SortKey = effectiveSort && effectiveSort in SORT_OPTIONS ? (effectiveSort as SortKey) : "best";
  const t = await getTranslations("Discover");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let providersQuery = supabase.from("provider_cards").select("*").eq("is_archived", false);
  if (q) {
    providersQuery = providersQuery.ilike("display_name", `%${q}%`);
  }

  if (pillKey === "safe") {
    providersQuery = providersQuery.eq("risk_level", "منخفضة");
  } else if (pillKey === "consistent") {
    providersQuery = providersQuery.eq("risk_level", "منخفضة").gt("avg_daily_return_pct", 0);
  } else if (pillKey === "rising") {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    providersQuery = providersQuery.gte("joined_at", sixtyDaysAgo).gte("followers_count", 20);
  }

  if (risk && (RISK_VALUES as readonly string[]).includes(risk)) {
    providersQuery = providersQuery.eq("risk_level", risk);
  }
  if (minEntry && !Number.isNaN(Number(minEntry))) {
    // "Minimum entry" filters BY the customer's own budget -- show leaders
    // whose min_copy_amount is at or below what they picked, not above.
    providersQuery = providersQuery.lte("min_copy_amount", Number(minEntry));
  }
  if (assetClass && ASSET_GROUPS[assetClass]) {
    // Every leader's symbol_bias already contains all 10 symbols, just
    // reordered by preference -- overlaps() against it would match
    // everyone. primary_symbol (symbol_bias[1], exposed as its own
    // column) is their actual dominant market.
    providersQuery = providersQuery.in("primary_symbol", ASSET_GROUPS[assetClass]);
  }
  if (trackRecord === "3m" || trackRecord === "1y") {
    const days = trackRecord === "3m" ? 90 : 365;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    providersQuery = providersQuery.lte("joined_at", cutoff);
  }

  const { column, ascending } = SORT_OPTIONS[sortKey];
  providersQuery = providersQuery.order(column, { ascending, nullsFirst: false });

  const [{ data: rawProviders }, { data: mySubscriptions }, { data: myFollows }] = await Promise.all([
    providersQuery,
    user
      ? supabase
          .from("subscriptions")
          .select("provider_id")
          .eq("follower_id", user.id)
          .eq("is_active", true)
      : Promise.resolve({ data: [] as { provider_id: string }[] }),
    user
      ? supabase.from("follows").select("provider_id").eq("follower_id", user.id)
      : Promise.resolve({ data: [] as { provider_id: string }[] }),
  ]);

  const providers = rawProviders;

  const followingIds = new Set(
    (mySubscriptions ?? []).map((s) => s.provider_id),
  );
  const followingProviderId = (mySubscriptions ?? [])[0]?.provider_id ?? null;
  const watchingIds = new Set((myFollows ?? []).map((f) => f.provider_id));

  return (
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>

        {error && (
          <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="flex items-center gap-2">
          <form method="get" className="relative min-w-0 flex-1">
            <svg
              viewBox="0 0 24 24"
              className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              name="q"
              defaultValue={q}
              placeholder={t("searchPlaceholder")}
              className="w-full rounded-full border border-white/[0.08] bg-surface/80 py-2 ps-9 pe-3 text-sm text-foreground backdrop-blur-md placeholder:text-muted focus:border-accent/40 focus:outline-none"
            />
            <input type="hidden" name="sort" value={sortKey} />
          </form>
          <DiscoverFilterSheet
            triggerLabel={t("filterButtonLabel")}
            applyLabel={t("filterApply")}
            resetLabel={t("filterReset")}
            closeLabel={t("closeFilters")}
            activeCount={
              [pillKey, sortKey !== "best" ? sortKey : null, risk, minEntry, assetClass, trackRecord].filter(Boolean).length
            }
            q={q}
            resetHref={q ? `/discover?q=${encodeURIComponent(q)}` : "/discover"}
            sections={[
              {
                name: "pill",
                label: t("quickCategoriesLabel"),
                current: pillKey ?? "",
                options: [
                  { value: "", label: t("pillAll") },
                  ...PILL_KEYS.map((key) => ({ value: key, label: t(PILL_LABEL_KEYS[key]) })),
                ],
              },
              {
                name: "sort",
                label: t("sortSectionLabel"),
                current: sortKey,
                options: (Object.keys(SORT_OPTIONS) as SortKey[]).map((key) => ({
                  value: key,
                  label: t(SORT_OPTIONS[key].labelKey),
                })),
              },
              {
                name: "risk",
                label: t("filterRisk"),
                current: risk ?? "",
                options: [
                  { value: "", label: t("filterAny") },
                  { value: "منخفضة", label: t("riskLow") },
                  { value: "متوسطة", label: t("riskModerate") },
                  { value: "مرتفعة", label: t("riskHigh") },
                ],
              },
              {
                name: "minEntry",
                label: t("filterMinEntry"),
                current: minEntry ?? "",
                options: [
                  { value: "", label: t("filterAny") },
                  { value: "100", label: "$100" },
                  { value: "500", label: "$500" },
                  { value: "1000", label: "$1000+" },
                ],
              },
              {
                name: "assetClass",
                label: t("pillAssets"),
                current: assetClass ?? "",
                options: [
                  { value: "", label: t("filterAny") },
                  { value: "gold", label: t("assetGold") },
                  { value: "crypto", label: t("assetCrypto") },
                  { value: "forex", label: t("assetForex") },
                ],
              },
              {
                name: "trackRecord",
                label: t("filterTrackRecord"),
                current: trackRecord ?? "",
                options: [
                  { value: "", label: t("filterAny") },
                  { value: "3m", label: t("trackRecord3m") },
                  { value: "1y", label: t("trackRecord1y") },
                ],
              },
            ]}
          />
        </div>

      {!providers || providers.length === 0 ? (
        <p className="text-sm text-muted">
          {t("noMatches")}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {providers.map((p) => {
            const isFollowing = followingIds.has(p.provider_id);
            const isBlocked = followingProviderId != null && !isFollowing;
            const isStopped = p.trading_status === "stopped";
            const isWatching = watchingIds.has(p.provider_id);
            const copyHref = user
              ? `/trader/${p.provider_id}#copy`
              : `/signup?next=${encodeURIComponent(`/trader/${p.provider_id}#copy`)}`;
            return (
              <LeaderCard
                key={p.provider_id}
                provider={p}
                copyHref={copyHref}
                isWatching={isWatching}
                onFollowAction={isWatching ? unfollowTrader : followTrader}
                copyState={isFollowing ? "stopCopying" : isStopped ? "stoppedDisabled" : isBlocked ? "blockedDisabled" : "copy"}
                onStopCopyingAction={unfollowProvider}
              />
            );
          })}
        </div>
      )}
      </main>
    </>
  );
}
