import { getMoney } from "@/lib/money-server";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { unfollowProvider, followTrader, unfollowTrader } from "@/app/discover/actions";
import { AppNav } from "@/components/AppNav";
import { LeaderCard } from "@/components/LeaderCard";
import { DiscoverFilterSheet } from "@/components/DiscoverFilterSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { isSelfServiceLeadTraderEligible } from "@/lib/lead-trader-tasks";
import {
  PERIODS,
  RISK_DB_VALUE,
  STYLES,
  parsePeriod,
  periodColumns,
  periodStats,
  type RiskKey,
} from "@/lib/leader-period";

// Every filter, sort and page is applied in the database on provider_cards,
// whose numbers all come from the leaders' trades (provider_stats), so the
// counts and pages are exact.

const SORT_KEYS = ["best", "roi", "pnl", "winrate", "drawdown", "followers", "aum", "sharpe", "newest"] as const;
type SortKey = (typeof SORT_KEYS)[number];
const SORT_LABEL: Record<SortKey, string> = {
  best: "sortBest",
  roi: "sortReturn",
  pnl: "sortProfit",
  winrate: "sortWinrate",
  drawdown: "sortDrawdown",
  followers: "sortFollowers",
  aum: "sortAum",
  sharpe: "sortSharpe",
  newest: "sortNewest",
};

const PILL_KEYS = ["safe", "consistent", "rising", "roi", "trusted"] as const;
type PillKey = (typeof PILL_KEYS)[number];
const PILL_LABEL_KEYS: Record<PillKey, string> = {
  safe: "pillSafe",
  consistent: "pillConsistent",
  rising: "pillRising",
  roi: "pillRoi",
  trusted: "pillTrusted",
};

const ASSET_CLASSES = ["gold", "crypto", "forex"] as const;
const SHARE_MAX = ["10", "15", "20", "25"] as const;
const WIN_MIN = ["50", "60", "70"] as const;
const ROI_MIN = ["0", "10", "25", "50"] as const;
const FOLLOWERS_MIN = ["50", "200", "500"] as const;
const AUM_MIN = ["50000", "250000", "1000000"] as const;
const DD_MAX = ["10", "20", "30"] as const;
const MIN_ENTRY = ["100", "500", "1000"] as const;
const PER_PAGE = { cards: ["12", "24", "48"], table: ["25", "50", "100"] } as const;

const pick = <T extends string>(list: readonly T[], value: string | undefined): T | null =>
  (list as readonly string[]).includes(value ?? "") ? (value as T) : null;

type Params = {
  q?: string;
  sort?: string;
  error?: string;
  pill?: string;
  risk?: string;
  style?: string;
  share?: string;
  minWin?: string;
  roiMin?: string;
  followers?: string;
  aum?: string;
  minEntry?: string;
  assetClass?: string;
  trackRecord?: string;
  view?: string;
  favorites?: string;
  period?: string;
  dd?: string;
  compare?: string;
  page?: string;
  per?: string;
};

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("discoverTitle"), description: t("discoverDesc") };
}

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const { q, error } = params;
  const period = parsePeriod(params.period);
  const cols = periodColumns(period);
  const pillKey = pick(PILL_KEYS, params.pill);
  const sortKey: SortKey = pick(SORT_KEYS, params.sort) ?? (pillKey === "roi" ? "roi" : pillKey === "trusted" ? "followers" : "best");
  const risk = params.risk && params.risk in RISK_DB_VALUE ? (params.risk as RiskKey) : null;
  const style = pick(STYLES, params.style);
  const share = pick(SHARE_MAX, params.share);
  const minWin = pick(WIN_MIN, params.minWin);
  const roiMin = pick(ROI_MIN, params.roiMin);
  const followersMin = pick(FOLLOWERS_MIN, params.followers);
  const aumMin = pick(AUM_MIN, params.aum);
  const ddMax = pick(DD_MAX, params.dd);
  const minEntry = pick(MIN_ENTRY, params.minEntry);
  const assetClass = pick(ASSET_CLASSES, params.assetClass);
  const trackRecord = params.trackRecord === "3m" || params.trackRecord === "1y" ? params.trackRecord : null;
  const viewMode = params.view === "table" ? "table" : "cards";
  const favoritesOnly = params.favorites === "1";
  const perPage = Number(pick(PER_PAGE[viewMode], params.per) ?? PER_PAGE[viewMode][viewMode === "table" ? 0 : 1]);
  const page = Math.max(1, Math.floor(Number(params.page) || 1));
  const compareIds = (params.compare ?? "").split(",").filter(Boolean).slice(0, 4);

  const t = await getTranslations("Discover");
  const money = await getMoney();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: mySubscriptions }, { data: myFollows }, { data: selfService }] = await Promise.all([
    user
      ? supabase.from("subscriptions").select("provider_id").eq("follower_id", user.id).eq("is_active", true)
      : Promise.resolve({ data: [] as { provider_id: string }[] }),
    user
      ? supabase.from("follows").select("provider_id").eq("follower_id", user.id)
      : Promise.resolve({ data: [] as { provider_id: string }[] }),
    // Self-service lead traders only appear once their task checklist is done.
    supabase.from("providers").select("id").not("user_id", "is", null),
  ]);
  const watchingIds = (myFollows ?? []).map((f) => f.provider_id);
  const followingIds = new Set((mySubscriptions ?? []).map((s) => s.provider_id));
  const hiddenIds = (
    await Promise.all(
      (selfService ?? []).map(async (r) => ((await isSelfServiceLeadTraderEligible(supabase, r.id)) ? null : r.id)),
    )
  ).filter((x): x is string => !!x);

  let query = supabase.from("provider_cards").select("*", { count: "exact" }).eq("is_archived", false);
  if (hiddenIds.length) query = query.not("provider_id", "in", `(${hiddenIds.join(",")})`);
  if (q) query = query.ilike("display_name", `%${q}%`);
  if (favoritesOnly) query = query.in("provider_id", watchingIds.length ? watchingIds : ["00000000-0000-0000-0000-000000000000"]);

  if (pillKey === "safe") query = query.eq("risk_level", RISK_DB_VALUE.low);
  if (pillKey === "consistent") query = query.in("risk_level", [RISK_DB_VALUE.low, RISK_DB_VALUE.medium]).gt("roi_90d", 0).gte("positive_months", 7);
  if (pillKey === "rising") query = query.lte("track_days", 180).gt(cols.roi, 0);

  if (risk) query = query.eq("risk_level", RISK_DB_VALUE[risk]);
  if (style) query = query.eq("style", style);
  if (share) query = query.lte("profit_share_pct", Number(share));
  if (minWin) query = query.gte(cols.winRate, Number(minWin));
  if (roiMin) query = roiMin === "0" ? query.gt(cols.roi, 0) : query.gte(cols.roi, Number(roiMin));
  if (followersMin) query = query.gte("followers_count", Number(followersMin));
  if (aumMin) query = query.gte("aum", Number(aumMin));
  if (ddMax) query = query.lte(cols.mdd, Number(ddMax));
  // "Minimum entry" filters by the customer's budget: leaders whose minimum
  // copy amount fits it.
  if (minEntry) query = query.lte("min_copy_amount", Number(minEntry));
  if (assetClass) query = query.eq("primary_asset", assetClass);
  if (trackRecord) query = query.gte("track_days", trackRecord === "3m" ? 90 : 365);

  const order: Record<SortKey, [string, boolean]> = {
    best: ["rating_score", false],
    roi: [cols.roi, false],
    pnl: [cols.pnl, false],
    winrate: [cols.winRate, false],
    drawdown: [cols.mdd, true],
    followers: ["followers_count", false],
    aum: ["aum", false],
    sharpe: [cols.sharpe, false],
    newest: ["joined_at", false],
  };
  const [orderColumn, ascending] = order[sortKey];
  query = query
    .order(orderColumn, { ascending, nullsFirst: false })
    .order("provider_id", { ascending: true })
    .range((page - 1) * perPage, page * perPage - 1);

  const { data: providers, count } = await query;
  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / perPage));

  // With nothing to show, tell "no leaders at all" apart from "no matches".
  let noLeadersAtAll = false;
  if (total === 0) {
    let anyQuery = supabase.from("provider_cards").select("provider_id", { count: "exact", head: true }).eq("is_archived", false);
    if (hiddenIds.length) anyQuery = anyQuery.not("provider_id", "in", `(${hiddenIds.join(",")})`);
    const { count: anyCount } = await anyQuery;
    noLeadersAtAll = (anyCount ?? 0) === 0;
  }

  const current: Record<string, string | null | undefined> = {
    q,
    sort: params.sort && pick(SORT_KEYS, params.sort) ? params.sort : null,
    pill: pillKey,
    risk,
    style,
    share,
    minWin,
    roiMin,
    followers: followersMin,
    aum: aumMin,
    minEntry,
    assetClass,
    trackRecord,
    view: viewMode === "table" ? "table" : null,
    favorites: favoritesOnly ? "1" : null,
    period: params.period && parsePeriod(params.period) === params.period ? params.period : null,
    dd: ddMax,
    compare: compareIds.length ? compareIds.join(",") : null,
    per: params.per && pick(PER_PAGE[viewMode], params.per) ? params.per : null,
  };
  const href = (changes: Record<string, string | null>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...current, ...changes })) if (v) sp.set(k, v);
    const s = sp.toString();
    return s ? `/discover?${s}` : "/discover";
  };
  const pageHref = (n: number) => href({ page: n > 1 ? String(n) : null });
  const compareHref = (id: string) => {
    const next = compareIds.includes(id) ? compareIds.filter((c) => c !== id) : [...compareIds, id].slice(0, 4);
    return href({ compare: next.length ? next.join(",") : null, page: page > 1 ? String(page) : null });
  };

  const periodLabel = (p: string) => t(`periodShort_${p}`);
  const any = { value: "", label: t("filterAny") };
  const activeCount = [pillKey, current.sort, risk, style, share, minWin, roiMin, followersMin, aumMin, ddMax, minEntry, assetClass, trackRecord, current.period].filter(Boolean).length;

  const pageNumbers = (() => {
    const set = new Set([1, pageCount, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pageCount));
    return [...set].sort((a, b) => a - b);
  })();
  const firstShown = total === 0 ? 0 : (page - 1) * perPage + 1;
  const lastShown = Math.min(total, page * perPage);

  return (
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6 pb-[calc(var(--bottom-nav-h)+1.5rem)] lg:ms-64 lg:me-0 lg:pb-6">
        <h1 className="text-page-title">{t("title")}</h1>

        {error && <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        <div className="flex items-center gap-2">
          <form method="get" className="relative min-w-0 flex-1">
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              name="q"
              defaultValue={q}
              placeholder={t("searchPlaceholder")}
              className="w-full rounded-full border border-white/[0.08] bg-surface/80 py-2 ps-9 pe-3 text-base text-foreground backdrop-blur-md placeholder:text-muted focus:border-accent/40 focus:outline-none"
            />
            {Object.entries(current).map(([k, v]) =>
              v && k !== "q" && k !== "compare" ? <input key={k} type="hidden" name={k} value={v} /> : null,
            )}
          </form>
          <DiscoverFilterSheet
            triggerLabel={t("filterButtonLabel")}
            applyLabel={t("filterApply")}
            resetLabel={t("filterReset")}
            closeLabel={t("closeFilters")}
            activeCount={activeCount}
            hidden={{ q, view: current.view, favorites: current.favorites, per: current.per }}
            resetHref={href({ sort: null, pill: null, risk: null, style: null, share: null, minWin: null, roiMin: null, followers: null, aum: null, minEntry: null, assetClass: null, trackRecord: null, period: null, dd: null, compare: null })}
            sections={[
              {
                name: "period",
                label: t("filterPeriod"),
                current: period,
                options: PERIODS.map((p) => ({ value: p, label: p === "all" ? t("periodAllTime") : t("periodDays", { days: Number(p) }) })),
              },
              {
                name: "sort",
                label: t("sortSectionLabel"),
                current: sortKey,
                options: SORT_KEYS.map((k) => ({ value: k, label: t(SORT_LABEL[k]) })),
              },
              {
                name: "pill",
                label: t("quickCategoriesLabel"),
                current: pillKey ?? "",
                options: [{ value: "", label: t("pillAll") }, ...PILL_KEYS.map((k) => ({ value: k, label: t(PILL_LABEL_KEYS[k]) }))],
              },
              {
                name: "style",
                label: t("filterStyle"),
                current: style ?? "",
                options: [any, ...STYLES.map((s) => ({ value: s, label: t(`style_${s}`) }))],
              },
              {
                name: "risk",
                label: t("filterRisk"),
                current: risk ?? "",
                options: [any, { value: "low", label: t("riskLow") }, { value: "medium", label: t("riskModerate") }, { value: "high", label: t("riskHigh") }],
              },
              {
                name: "roiMin",
                label: t("filterRoi", { period: periodLabel(period) }),
                current: roiMin ?? "",
                options: [any, ...ROI_MIN.map((v) => ({ value: v, label: v === "0" ? t("roiProfitable") : t("roiAtLeast", { pct: Number(v) }) }))],
              },
              {
                name: "minWin",
                label: t("filterWinRate"),
                current: minWin ?? "",
                options: [any, ...WIN_MIN.map((v) => ({ value: v, label: t("atLeastPct", { pct: Number(v) }) }))],
              },
              {
                name: "dd",
                label: t("filterMaxDrawdown"),
                current: ddMax ?? "",
                options: [any, ...DD_MAX.map((v) => ({ value: v, label: `≤ ${v}%` }))],
              },
              {
                name: "share",
                label: t("filterProfitShare"),
                current: share ?? "",
                options: [any, ...SHARE_MAX.map((v) => ({ value: v, label: t("upToPct", { pct: Number(v) }) }))],
              },
              {
                name: "followers",
                label: t("filterFollowers"),
                current: followersMin ?? "",
                options: [any, ...FOLLOWERS_MIN.map((v) => ({ value: v, label: t("atLeastCount", { count: Number(v) }) }))],
              },
              {
                name: "aum",
                label: t("filterAum"),
                current: aumMin ?? "",
                options: [any, ...AUM_MIN.map((v) => ({ value: v, label: `${money(Number(v), { decimals: 0, compact: true })}+` }))],
              },
              {
                name: "assetClass",
                label: t("pillAssets"),
                current: assetClass ?? "",
                options: [any, { value: "gold", label: t("assetGold") }, { value: "crypto", label: t("assetCrypto") }, { value: "forex", label: t("assetForex") }],
              },
              {
                name: "minEntry",
                label: t("filterMinEntry"),
                current: minEntry ?? "",
                options: [any, ...MIN_ENTRY.map((v) => ({ value: v, label: money(Number(v), { decimals: 0 }) }))],
              },
              {
                name: "trackRecord",
                label: t("filterTrackRecord"),
                current: trackRecord ?? "",
                options: [any, { value: "3m", label: t("trackRecord3m") }, { value: "1y", label: t("trackRecord1y") }],
              },
            ]}
          />
        </div>

        {/* Period switch, like the 7D / 30D / 90D tabs on copy-trading platforms. */}
        <div className="flex gap-1 overflow-x-auto rounded-full border border-border bg-surface p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={href({ period: p === "30" ? null : p, page: null })}
              className={
                period === p
                  ? "min-w-fit flex-1 rounded-full bg-accent px-3 py-1.5 text-center text-sm font-medium text-accent-foreground"
                  : "min-w-fit flex-1 rounded-full px-3 py-1.5 text-center text-sm text-muted transition hover:text-foreground"
              }
            >
              {periodLabel(p)}
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Link
              href={href({ favorites: favoritesOnly ? null : "1", page: null })}
              className={
                favoritesOnly
                  ? "rounded-full border border-accent bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent"
                  : "rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted transition hover:border-accent/40"
              }
            >
              {t("favoritesOnly")}
            </Link>
            <span className="text-xs text-muted">{t("resultsCount", { count: total })}</span>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-border p-0.5">
            <Link
              href={href({ view: null, per: null, page: null })}
              className={viewMode === "cards" ? "rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground" : "rounded-full px-3 py-1 text-xs text-muted"}
            >
              {t("viewCards")}
            </Link>
            <Link
              href={href({ view: "table", per: null, page: null })}
              className={viewMode === "table" ? "rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground" : "rounded-full px-3 py-1 text-xs text-muted"}
            >
              {t("viewTable")}
            </Link>
          </div>
        </div>

        {compareIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-2 text-sm">
            <span>{t("compareSelected", { count: compareIds.length })}</span>
            <div className="flex gap-2">
              <Link href={href({ compare: null })} className="text-muted hover:text-foreground">
                {t("compareClear")}
              </Link>
              {compareIds.length >= 2 && (
                <Link href={`/discover/compare?ids=${compareIds.join(",")}&period=${period}`} className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
                  {t("compareNow")}
                </Link>
              )}
            </div>
          </div>
        )}

        {!providers || providers.length === 0 ? (
          noLeadersAtAll ? (
            <EmptyState message={t("emptyNoLeaders")} />
          ) : (
            <EmptyState message={t("noMatches")} actionHref="/discover" actionLabel={t("filterReset")} />
          )
        ) : viewMode === "table" ? (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[760px] border-collapse text-start">
              <thead>
                <tr className="border-b border-border bg-surface text-xs text-muted">
                  <th className="px-4 py-3 text-start font-normal">{t("tableName")}</th>
                  <th className="px-3 py-3 text-start font-normal">{t("roiLabel", { period: periodLabel(period) })}</th>
                  <th className="px-3 py-3 text-start font-normal">{t("pnlLabel")}</th>
                  <th className="px-3 py-3 text-start font-normal">{t("winRate")}</th>
                  <th className="px-3 py-3 text-start font-normal">{t("maxDrawdown")}</th>
                  <th className="px-3 py-3 text-start font-normal">{t("copiersLabel")}</th>
                  <th className="px-3 py-3 text-start font-normal">{t("aumLabel")}</th>
                  <th className="px-3 py-3 text-start font-normal">{t("profitShareLabel")}</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {providers.map((p) => {
                  const s = periodStats(p, period);
                  return (
                    <tr key={p.provider_id} className="border-b border-border last:border-b-0 hover:bg-surface/60">
                      <td className="px-4 py-3">
                        <Link href={`/trader/${p.provider_id}`} className="text-sm font-medium hover:text-accent">
                          {p.display_name}
                        </Link>
                      </td>
                      <td className={`px-3 py-3 text-sm ${s.roi != null && s.roi < 0 ? "text-danger" : "text-success"}`} dir="ltr">
                        {s.roi != null ? `${s.roi > 0 ? "+" : ""}${s.roi.toFixed(2)}%` : "—"}
                      </td>
                      <td className={`px-3 py-3 text-sm ${s.pnl != null && s.pnl < 0 ? "text-danger" : ""}`} dir="ltr">
                        {s.pnl != null ? money(s.pnl, { signed: true, compact: true }) : "—"}
                      </td>
                      <td className="px-3 py-3 text-sm" dir="ltr">{s.winRate != null ? `${s.winRate.toFixed(1)}%` : "—"}</td>
                      <td className="px-3 py-3 text-sm" dir="ltr">{s.mdd != null ? `${s.mdd.toFixed(1)}%` : "—"}</td>
                      <td className="px-3 py-3 text-sm">{p.followers_count}</td>
                      <td className="px-3 py-3 text-sm" dir="ltr">{p.aum ? money(Number(p.aum), { compact: true }) : "—"}</td>
                      <td className="px-3 py-3 text-sm" dir="ltr">{p.profit_share_pct != null ? `${Number(p.profit_share_pct)}%` : "—"}</td>
                      <td className="px-3 py-3 text-end">
                        <Link href={compareHref(p.provider_id)} className="me-3 text-xs text-muted hover:text-accent">
                          {compareIds.includes(p.provider_id) ? t("compareRemove") : t("compareAdd")}
                        </Link>
                        <Link href={`/trader/${p.provider_id}#copy`} className="text-sm font-medium text-accent hover:underline">
                          {t("viewProfile")}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {providers.map((p) => {
              const isFollowing = followingIds.has(p.provider_id);
              const isStopped = p.trading_status === "stopped";
              const isWatching = watchingIds.includes(p.provider_id);
              const copyHref = user ? `/trader/${p.provider_id}#copy` : `/signup?next=${encodeURIComponent(`/trader/${p.provider_id}#copy`)}`;
              return (
                <div key={p.provider_id} className="flex flex-col gap-1">
                  <LeaderCard
                    provider={p}
                    period={period}
                    copyHref={copyHref}
                    isWatching={isWatching}
                    onFollowAction={isWatching ? unfollowTrader : followTrader}
                    copyState={isFollowing ? "stopCopying" : isStopped ? "stoppedDisabled" : "copy"}
                    onStopCopyingAction={unfollowProvider}
                  />
                  <Link
                    href={compareHref(p.provider_id)}
                    className={compareIds.includes(p.provider_id) ? "self-end px-2 text-xs font-medium text-accent" : "self-end px-2 text-xs text-muted hover:text-accent"}
                  >
                    {compareIds.includes(p.provider_id) ? t("compareRemove") : t("compareAdd")}
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        {total > 0 && (
          <nav className="flex flex-col items-center gap-3 text-center" aria-label={t("paginationLabel")}>
            <p className="text-xs text-muted">{t("showingRange", { from: firstShown, to: lastShown, total })}</p>
            {pageCount > 1 && (
              <div className="flex flex-wrap items-center justify-center gap-1">
                {page > 1 && (
                  <Link href={pageHref(page - 1)} className="rounded-full border border-border px-3 py-1.5 text-sm hover:border-accent/40">
                    {t("prevPage")}
                  </Link>
                )}
                {pageNumbers.map((n, i) => (
                  <span key={n} className="flex items-center gap-1">
                    {i > 0 && n - pageNumbers[i - 1] > 1 && <span className="px-1 text-muted">…</span>}
                    <Link
                      href={pageHref(n)}
                      aria-current={n === page ? "page" : undefined}
                      className={
                        n === page
                          ? "min-w-9 rounded-full bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground"
                          : "min-w-9 rounded-full border border-border px-3 py-1.5 text-sm hover:border-accent/40"
                      }
                    >
                      {n}
                    </Link>
                  </span>
                ))}
                {page < pageCount && (
                  <Link href={pageHref(page + 1)} className="rounded-full border border-border px-3 py-1.5 text-sm hover:border-accent/40">
                    {t("nextPage")}
                  </Link>
                )}
              </div>
            )}
            <div className="flex items-center gap-1 text-xs text-muted">
              <span>{t("perPageLabel")}</span>
              {PER_PAGE[viewMode].map((n) => (
                <Link
                  key={n}
                  href={href({ per: n === PER_PAGE[viewMode][viewMode === "table" ? 0 : 1] ? null : n, page: null })}
                  className={perPage === Number(n) ? "rounded-full bg-accent/15 px-2 py-0.5 font-medium text-accent" : "rounded-full px-2 py-0.5 hover:text-foreground"}
                >
                  {n}
                </Link>
              ))}
            </div>
          </nav>
        )}
      </main>
    </>
  );
}
