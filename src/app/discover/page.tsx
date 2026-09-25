import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { unfollowProvider, followTrader, unfollowTrader } from "@/app/discover/actions";
import { AppNav } from "@/components/AppNav";
import { BackButton } from "@/components/BackButton";
import { TierBadge, RiskBadge, StoppedBadge } from "@/components/TraderBadges";
import { TraderAvatar } from "@/components/TraderAvatar";
import { SortDropdown } from "@/components/SortDropdown";
import { DiscoverFilterPanel } from "@/components/DiscoverFilterPanel";

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

  // Builds a /discover?... href starting from the CURRENT filters, with
  // one or more overridden -- passing null for a key removes it (toggle
  // off). Every pill/advanced-filter control is a plain server-rendered
  // link built from this, consistent with how q/sort already work here.
  const currentParams: Record<string, string | undefined> = { q, sort, pill: pillKey ?? undefined, risk, minEntry, assetClass, trackRecord };
  function hrefWith(overrides: Record<string, string | null>) {
    const params = new URLSearchParams();
    const merged = { ...currentParams, ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      if (value) params.set(key, value);
    }
    return `/discover?${params.toString()}`;
  }

  return (
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
        <BackButton fallbackHref="/dashboard" />
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
          <SortDropdown
            compact
            currentLabel={t(SORT_OPTIONS[sortKey].labelKey)}
            options={(Object.keys(SORT_OPTIONS) as SortKey[]).map((key) => ({
              key,
              label: t(SORT_OPTIONS[key].labelKey),
              href: hrefWith({ sort: key }),
              active: key === sortKey,
            }))}
          />
          <DiscoverFilterPanel
            compact
            active={Boolean(risk || minEntry || assetClass || trackRecord)}
            triggerLabel={t("advancedFilters")}
            closeLabel={t("closeFilters")}
            sections={[
            {
              label: t("filterRisk"),
              options: [
                { label: t("filterAny"), href: hrefWith({ risk: null }), active: !risk },
                { label: t("riskLow"), href: hrefWith({ risk: "منخفضة" }), active: risk === "منخفضة" },
                { label: t("riskModerate"), href: hrefWith({ risk: "متوسطة" }), active: risk === "متوسطة" },
                { label: t("riskHigh"), href: hrefWith({ risk: "مرتفعة" }), active: risk === "مرتفعة" },
              ],
            },
            {
              label: t("filterMinEntry"),
              options: [
                { label: t("filterAny"), href: hrefWith({ minEntry: null }), active: !minEntry },
                { label: "$100", href: hrefWith({ minEntry: "100" }), active: minEntry === "100" },
                { label: "$500", href: hrefWith({ minEntry: "500" }), active: minEntry === "500" },
                { label: "$1000+", href: hrefWith({ minEntry: "1000" }), active: minEntry === "1000" },
              ],
            },
            {
              label: t("pillAssets"),
              options: [
                { label: t("filterAny"), href: hrefWith({ assetClass: null }), active: !assetClass },
                { label: t("assetGold"), href: hrefWith({ assetClass: "gold" }), active: assetClass === "gold" },
                { label: t("assetCrypto"), href: hrefWith({ assetClass: "crypto" }), active: assetClass === "crypto" },
                { label: t("assetForex"), href: hrefWith({ assetClass: "forex" }), active: assetClass === "forex" },
              ],
            },
            {
              label: t("filterTrackRecord"),
              options: [
                { label: t("filterAny"), href: hrefWith({ trackRecord: null }), active: !trackRecord },
                { label: t("trackRecord3m"), href: hrefWith({ trackRecord: "3m" }), active: trackRecord === "3m" },
                { label: t("trackRecord1y"), href: hrefWith({ trackRecord: "1y" }), active: trackRecord === "1y" },
              ],
            },
          ]}
        />
      </div>

      <div className="-mx-6 flex snap-x gap-2 overflow-x-auto px-6 scrollbar-hide">
        <Link
          href={hrefWith({ pill: null })}
          className={
            pillKey === null
              ? "shrink-0 snap-start rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-sm font-medium text-accent"
              : "shrink-0 snap-start rounded-full border border-white/[0.08] bg-surface/60 px-3 py-1.5 text-sm text-foreground backdrop-blur-md transition hover:border-accent/30"
          }
        >
          {t("pillAll")}
        </Link>
        {PILL_KEYS.map((key) => (
          <Link
            key={key}
            href={hrefWith({ pill: pillKey === key ? null : key })}
            className={
              pillKey === key
                ? "shrink-0 snap-start rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-sm font-medium text-accent"
                : "shrink-0 snap-start rounded-full border border-white/[0.08] bg-surface/60 px-3 py-1.5 text-sm text-foreground backdrop-blur-md transition hover:border-accent/30"
            }
          >
            {t(PILL_LABEL_KEYS[key])}
          </Link>
        ))}
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
            const isDown = p.avg_daily_return_pct != null && p.avg_daily_return_pct < 0;
            return (
              <div
                key={p.provider_id}
                className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-white/[0.08] bg-surface/70 p-4 shadow-lg shadow-black/20 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-xl hover:shadow-accent/10"
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-accent/[0.07] to-transparent" />

                <Link
                  href={`/trader/${p.provider_id}`}
                  aria-label={p.display_name ?? ""}
                  className="absolute inset-0 z-0"
                />

                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                  <TraderAvatar
                    providerId={p.provider_id}
                    name={p.display_name}
                    avatarUrl={p.avatar_url}
                    ratingScore={p.rating_score}
                    size={48}
                    showLevel
                  />
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-1">
                      <p className="min-w-0 truncate text-base font-semibold tracking-tight">
                        {p.display_name}
                      </p>
                      <form action={isWatching ? unfollowTrader : followTrader} className="relative z-10 shrink-0">
                        <input type="hidden" name="providerId" value={p.provider_id} />
                        <button
                          type="submit"
                          title={isWatching ? t("unfollow") : t("follow")}
                          aria-label={isWatching ? t("unfollow") : t("follow")}
                          className={
                            isWatching
                              ? "flex h-4 w-4 items-center justify-center text-accent"
                              : "flex h-4 w-4 items-center justify-center text-muted transition hover:text-accent"
                          }
                        >
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill={isWatching ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M12 17.3 6.2 21l1.6-6.6-5-4.6 6.7-.6L12 3l2.5 6.2 6.7.6-5 4.6 1.6 6.6z" />
                          </svg>
                        </button>
                      </form>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <TierBadge tier={p.tier} />
                      <RiskBadge level={p.risk_level} />
                      <StoppedBadge stopped={isStopped} />
                    </div>
                  </div>
                </div>

                  {isFollowing ? (
                    <form action={unfollowProvider} className="relative z-10 shrink-0">
                      <input type="hidden" name="providerId" value={p.provider_id} />
                      <input type="hidden" name="returnTo" value="/discover" />
                      <button type="submit" className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted transition hover:border-muted hover:text-foreground">
                        {t("stopCopying")}
                      </button>
                    </form>
                  ) : isStopped ? (
                    <button
                      type="button"
                      disabled
                      title={t("stoppedTooltip")}
                      className="relative z-10 shrink-0 cursor-not-allowed rounded-full bg-border px-3 py-1.5 text-xs font-medium text-muted"
                    >
                      {t("copy")}
                    </button>
                  ) : isBlocked ? (
                    <button
                      type="button"
                      disabled
                      title={t("blockedTooltip")}
                      className="relative z-10 shrink-0 cursor-not-allowed rounded-full bg-border px-3 py-1.5 text-xs font-medium text-muted"
                    >
                      {t("copy")}
                    </button>
                  ) : (
                    <Link
                      href={copyHref}
                      className="relative z-10 shrink-0 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground transition hover:bg-accent-hover"
                    >
                      {t("copy")}
                    </Link>
                  )}
                </div>

                <div className="flex items-center overflow-hidden rounded-xl border border-white/[0.06] bg-background/60">
                  <div className="flex-1 border-e border-white/10 px-2 py-2.5 text-center">
                    <p className="text-sm font-semibold text-success">
                      {p.win_rate_pct != null ? `${p.win_rate_pct}%` : "—"}
                    </p>
                    <p className="text-[11px] text-muted">{t("winRate")}</p>
                  </div>
                  <div className="flex-1 border-e border-white/10 px-2 py-2.5 text-center">
                    <p className={isDown ? "text-sm font-semibold text-danger" : "text-sm font-semibold text-success"}>
                      {p.avg_daily_return_pct != null ? `${p.avg_daily_return_pct}%` : "—"}
                    </p>
                    <p className="text-[11px] text-muted">{t("avgDailyReturn")}</p>
                  </div>
                  <div className="flex-1 px-2 py-2.5 text-center">
                    <p className="text-sm font-semibold">{p.followers_count}</p>
                    <p className="text-[11px] text-muted">{t("copiersLabel")}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-muted">
                  <span>{t("minCopyAmount", { amount: `$${Number(p.min_copy_amount).toLocaleString("en-US")}` })}</span>
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
                <div className="relative z-10 flex flex-col gap-2">
                  <Link
                    href={`/trader/${p.provider_id}`}
                    className="rounded-lg border border-border bg-transparent px-3 py-2.5 text-center text-sm font-medium text-foreground transition hover:border-accent/50 hover:bg-accent/5"
                  >
                    {t("viewProfile")}
                  </Link>
                  {isFollowing ? (
                    <form action={unfollowProvider}>
                      <input type="hidden" name="providerId" value={p.provider_id} />
                      <input type="hidden" name="returnTo" value="/discover" />
                      <button type="submit" className="w-full rounded-lg border border-border px-3 py-2.5 text-sm transition hover:border-muted">
                        {t("stopCopying")}
                      </button>
                    </form>
                  ) : isStopped ? (
                    <button
                      type="button"
                      disabled
                      title={t("stoppedTooltip")}
                      className="w-full cursor-not-allowed rounded-lg bg-border px-3 py-2.5 text-sm font-medium text-muted"
                    >
                      {t("copy")}
                    </button>
                  ) : isBlocked ? (
                    <button
                      type="button"
                      disabled
                      title={t("blockedTooltip")}
                      className="w-full cursor-not-allowed rounded-lg bg-border px-3 py-2.5 text-sm font-medium text-muted"
                    >
                      {t("copy")}
                    </button>
                  ) : (
                    <Link
                      href={copyHref}
                      className="w-full rounded-lg bg-accent px-3 py-2.5 text-center text-sm font-medium text-accent-foreground transition hover:bg-accent-hover"
                    >
                      {t("copy")}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      </main>
    </>
  );
}
