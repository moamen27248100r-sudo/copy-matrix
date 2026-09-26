import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { followProvider, unfollowProvider, followTrader, unfollowTrader } from "@/app/discover/actions";
import { AppNav } from "@/components/AppNav";
import { TierBadge, RiskBadge } from "@/components/TraderBadges";
import { TraderEquityChart } from "@/components/TraderEquityChart";
import { TradeHistory } from "@/components/TradeHistory";
import { CircularGauge, getGaugeTier } from "@/components/CircularGauge";
import { AssetAllocationBar } from "@/components/AssetAllocationBar";
import { OpenOrdersTable } from "@/components/OpenOrdersTable";
import { RecentCopiersList } from "@/components/RecentCopiersList";
import { TraderAvatar } from "@/components/TraderAvatar";
import { countryDisplay } from "@/lib/country-metadata";
import { formatDate } from "@/lib/locale-format";
import { getBioTranslator } from "@/lib/bio-translations";
import type { Locale } from "@/i18n/locales";

type SignalRow = {
  id: string;
  symbol: string;
  side: string;
  entry_price: number;
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  status: string;
  opened_at: string;
  closed_at: string | null;
};

function periodStats(signals: SignalRow[], days: number) {
  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
  const closed = signals.filter(
    (s) => s.status === "closed" && s.closed_at && new Date(s.closed_at).getTime() >= cutoffMs,
  );

  if (closed.length === 0) return { count: 0, winRate: null as number | null, totalReturn: null as number | null };

  let wins = 0;
  let totalReturn = 0;
  for (const s of closed) {
    const raw = (s.exit_price! - s.entry_price) / s.entry_price;
    const signed = s.side === "sell" ? -raw : raw;
    if (signed > 0) wins++;
    totalReturn += signed * 100;
  }

  return {
    count: closed.length,
    winRate: Math.round((wins / closed.length) * 100),
    // Real realized performance for the period (sum of each trade's %
    // return, same convention TraderEquityChart already uses for its
    // cumulative line) — not an average per trade.
    totalReturn: Math.round(totalReturn * 100) / 100,
  };
}

function computeMaxDrawdown(signals: SignalRow[]) {
  const closed = signals
    .filter((s) => s.status === "closed" && s.exit_price != null && s.closed_at)
    .sort((a, b) => new Date(a.closed_at!).getTime() - new Date(b.closed_at!).getTime());

  if (closed.length === 0) return null;

  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const s of closed) {
    const raw = (s.exit_price! - s.entry_price) / s.entry_price;
    const signed = s.side === "sell" ? -raw : raw;
    cumulative += signed * 100;
    if (cumulative > peak) peak = cumulative;
    const drawdown = peak - cumulative;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }
  return Math.round(maxDrawdown * 100) / 100;
}

export default async function TraderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { id } = await params;
  const { error, success } = await searchParams;
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("TraderProfile");
  const tp = await getTranslations("TradeHistory");
  const tc = await getTranslations("Countries");
  const translateBio = await getBioTranslator();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let [{ data: provider }, { data: signals }, { data: recentCopiers }, { data: mySub }, { data: myProfile }, { data: otherSub }, { data: myFollow }] = await Promise.all([
    supabase.from("provider_cards").select("*").eq("provider_id", id).single(),
    supabase
      .from("signals")
      .select("id, symbol, side, entry_price, exit_price, stop_loss, take_profit, status, opened_at, closed_at")
      .eq("provider_id", id)
      // created_by_admin signals are per-customer trades (manual corrections,
      // margin calls, and the density-mechanic phantom positions below) --
      // they belong to that one customer's own view, not the leader's public
      // track record.
      .eq("created_by_admin", false)
      .order("opened_at", { ascending: false }),
    supabase
      .from("synthetic_customers")
      .select("id, display_name, joined_at, current_capital, starting_capital, total_deposited")
      .eq("provider_id", id)
      .neq("copy_status", "left")
      .order("current_capital", { ascending: false })
      .limit(20),
    user
      ? supabase
          .from("subscriptions")
          .select("id, allocated_amount, max_drawdown_pct")
          .eq("follower_id", user.id)
          .eq("provider_id", id)
          .eq("is_active", true)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    user
      ? supabase.from("profiles").select("balance").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
    user
      ? supabase
          .from("subscriptions")
          .select("provider_id")
          .eq("follower_id", user.id)
          .eq("is_active", true)
          .neq("provider_id", id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    user
      ? supabase.from("follows").select("provider_id").eq("follower_id", user.id).eq("provider_id", id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!provider) {
    // A missing row here usually means the id genuinely doesn't exist,
    // but Supabase returns the same null data for a transient query
    // failure (a brief DB connection hiccup) -- there's no way to tell
    // those apart from `data` alone. One retry before committing to a
    // 404 filters out the transient case instead of showing a false
    // "trader not found" for what was really just a dropped request.
    const retry = await supabase.from("provider_cards").select("*").eq("provider_id", id).single();
    provider = retry.data;
  }

  if (!provider) {
    notFound();
  }

  const allSignals = (signals ?? []) as SignalRow[];
  const isFollowing = !!mySub;
  const isWatching = !!myFollow;
  const maxDrawdown = computeMaxDrawdown(allSignals);

  const closedHistory = allSignals
    .filter((s) => s.status === "closed" && s.exit_price != null)
    .map((s) => {
      const raw = (s.exit_price! - s.entry_price) / s.entry_price;
      const pct = (s.side === "sell" ? -raw : raw) * 100;
      return {
        id: s.id,
        symbol: s.symbol,
        side: s.side,
        entry: Number(s.entry_price),
        exit: Number(s.exit_price),
        pct,
        openedAt: s.opened_at,
        closedAt: s.closed_at,
        stopLoss: s.stop_loss,
        takeProfit: s.take_profit,
        copyHref: "#copy",
      };
    });

  const openOrders = allSignals.filter((s) => s.status === "open");
  const openSymbols = Array.from(new Set(openOrders.map((s) => s.symbol)));
  const { data: livePrices } =
    openSymbols.length > 0
      ? await supabase.from("market_prices").select("symbol, price").in("symbol", openSymbols)
      : { data: [] as { symbol: string; price: number }[] };
  const initialPrices: Record<string, number> = Object.fromEntries(
    (livePrices ?? []).map((p) => [p.symbol, Number(p.price)]),
  );

  const reliabilityScore = Number(provider.rating_score ?? 50);
  const safetyScore = Math.max(0, Math.min(100, Math.round(100 - Number(provider.return_volatility ?? 2) * 15)));
  const riskExposureScore =
    maxDrawdown != null ? Math.max(0, Math.min(100, Math.round(maxDrawdown * 8))) : 20;

  const STATUS_KEYS = {
    reliability: { low: "reliabilityStatusLow", medium: "reliabilityStatusMedium", high: "reliabilityStatusHigh" },
    safety: { low: "safetyStatusLow", medium: "safetyStatusMedium", high: "safetyStatusHigh" },
    risk: { low: "riskStatusLow", medium: "riskStatusMedium", high: "riskStatusHigh" },
  } as const;
  const reliabilityStatus = t(STATUS_KEYS.reliability[getGaugeTier(reliabilityScore, "reliability")]);
  const safetyStatus = t(STATUS_KEYS.safety[getGaugeTier(safetyScore, "safety")]);
  const riskStatus = t(STATUS_KEYS.risk[getGaugeTier(riskExposureScore, "risk")]);

  const daysAsMember = Math.max(
    0,
    Math.floor((Date.now() - new Date(provider.joined_at).getTime()) / (24 * 60 * 60 * 1000)),
  );

  let otherProviderName: string | null = null;
  if (otherSub) {
    const { data: otherProvider } = await supabase
      .from("provider_cards")
      .select("display_name")
      .eq("provider_id", otherSub.provider_id)
      .single();
    otherProviderName = otherProvider?.display_name ?? t("anotherTraderFallback");
  }
  const isBlocked = !!otherSub;
  const isStopped = provider.trading_status === "stopped";

  const periods = [
    { labelKey: "periodToday", days: 1 },
    { labelKey: "periodWeek", days: 7 },
    { labelKey: "periodMonth", days: 30 },
    { labelKey: "periodThreeMonths", days: 90 },
    { labelKey: "periodSixMonths", days: 180 },
  ];

  return (
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
        {error && (
          <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        {success === "started" && mySub && (
          <p className="rounded border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
            {t("copyStartedSuccess", {
              name: provider.display_name,
              amount: `$${Number(mySub.allocated_amount).toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
            })}
          </p>
        )}

      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center gap-4">
          <TraderAvatar providerId={id} name={provider.display_name} avatarUrl={provider.avatar_url} ratingScore={provider.rating_score} size={64} priority />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">{provider.display_name}</h1>
              <form action={isWatching ? unfollowTrader : followTrader}>
                <input type="hidden" name="providerId" value={id} />
                <button
                  type="submit"
                  className={
                    isWatching
                      ? "rounded-full border border-border px-3 py-0.5 text-xs text-muted"
                      : "rounded-full border border-accent px-3 py-0.5 text-xs text-accent"
                  }
                >
                  {isWatching ? t("unfollow") : t("follow")}
                </button>
              </form>
            </div>
            <p className="text-xs text-muted">
              {t("memberSince", {
                date: formatDate(provider.joined_at, locale, { year: "numeric", month: "long", timeZone: "UTC" }),
              })}
              {countryDisplay(provider.country) && (
                <span className="inline-flex items-center gap-1 align-text-bottom">
                  {" · "}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://flagcdn.com/16x12/${provider.country!.toLowerCase()}.png`}
                    alt=""
                    width={16}
                    height={12}
                    className="inline-block rounded-[1px]"
                  />
                  {tc(provider.country as never)}
                </span>
              )}
            </p>
            {isWatching && (
              <p className="mt-0.5 text-[11px] text-muted">
                {t("followNotifyNote")}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <TierBadge tier={provider.tier} />
          <RiskBadge level={provider.risk_level} />
        </div>

        {provider.bio && <p className="text-sm text-muted">{translateBio(provider.bio)}</p>}

        {recentCopiers && recentCopiers.length > 0 && (
          <details className="group rounded-lg border border-accent/40 bg-accent/10">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-accent transition hover:bg-accent/15 [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                {t("copiersListLabel", { count: provider.followers_count })}
              </span>
              <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </summary>
            <div className="border-t border-accent/30 p-3">
              <RecentCopiersList copiers={recentCopiers} providerId={id} />
            </div>
          </details>
        )}

        <div id="copy" className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3 scroll-mt-20">
          {!user ? (
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted">
                {t("signupPrompt", { name: provider.display_name })}
              </p>
              <Link
                href={`/signup?next=${encodeURIComponent(`/trader/${id}#copy`)}`}
                className="w-full shrink-0 rounded bg-accent px-4 py-1.5 text-center text-sm font-medium text-accent-foreground transition hover:bg-accent-hover sm:w-fit"
              >
                {t("signupCta")}
              </Link>
            </div>
          ) : isStopped ? (
            <div className="flex flex-col gap-2 rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              <p>
                {t("stoppedTradingNotice", { name: provider.display_name })}
              </p>
            </div>
          ) : isBlocked ? (
            <div className="flex flex-col gap-2 rounded border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
              <p>
                {t.rich("blockedNotice", {
                  otherName: otherProviderName ?? t("anotherTraderFallback"),
                  name: provider.display_name,
                  strong: (chunks) => <strong>{chunks}</strong>,
                  link: (chunks) => (
                    <Link href="/portfolio" className="underline">
                      {chunks}
                    </Link>
                  ),
                })}
              </p>
            </div>
          ) : isFollowing ? (
            <p className="flex items-center gap-2 text-sm">
              <span className="h-2 w-2 shrink-0 rounded-full bg-success" aria-hidden="true" />
              {t("currentlyCopyingAmount", {
                amount: `$${Number(mySub?.allocated_amount ?? 0).toLocaleString("en-US")}`,
              })}
            </p>
          ) : (
          <form action={followProvider} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="providerId" value={id} />
            <label className="flex items-center gap-2 text-sm text-muted">
              {t("copyAmountLabel")}
              <input
                name="allocatedAmount"
                type="number"
                step="any"
                min={0}
                defaultValue={myProfile?.balance ?? provider.min_copy_amount}
                required
                className="w-28 rounded border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
              />
            </label>
            <button
              type="submit"
              className="rounded bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground transition hover:bg-accent-hover"
            >
              {t("copyCta")}
            </button>
          </form>
          )}
          {isFollowing && (
            <form action={unfollowProvider}>
              <input type="hidden" name="providerId" value={id} />
              <input type="hidden" name="returnTo" value={`/trader/${id}`} />
              <button type="submit" className="rounded border border-border px-4 py-1.5 text-sm">
                {t("stopCopyingCta")}
              </button>
            </form>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">
            {t("minCopyBadgeLabel")} <span dir="ltr">${Number(provider.min_copy_amount).toLocaleString("en-US")}</span>
          </span>
          {user && (
            <span className="text-xs text-muted">
              {t("availableBalanceLabel")}{" "}
              <span dir="ltr">
                {myProfile?.balance != null
                  ? `$${Number(myProfile.balance).toLocaleString("en-US", { maximumFractionDigits: 2 })}`
                  : "—"}
              </span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 text-center text-sm sm:grid-cols-3">
          <div>
            <p className="font-semibold">{provider.followers_count}</p>
            <p className="text-xs text-muted">{t("statCopiers")}</p>
          </div>
          <div>
            <p className={Number(provider.total_profit) >= 0 ? "font-semibold text-success" : "font-semibold text-danger"}>
              {Number(provider.total_profit) >= 0 ? "+" : "-"}$
              {Math.abs(Number(provider.total_profit)).toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-muted">{t("statTotalProfit")}</p>
          </div>
          <div>
            <p className="font-semibold">
              ${Number(provider.total_withdrawals).toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-muted">{t("statTotalWithdrawals")}</p>
          </div>
          <div>
            <p className="font-semibold">
              ${Number(provider.account_capital ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-muted">{t("statCurrentCapital")}</p>
          </div>
          <div>
            <p className="font-semibold">
              {provider.win_rate_pct != null ? `${provider.win_rate_pct}%` : "—"}
            </p>
            <p className="text-xs text-muted">{t("statOverallWinRate")}</p>
          </div>
          <div>
            <p className="font-semibold text-danger" dir="ltr">
              {maxDrawdown != null ? `-${maxDrawdown}%` : "—"}
            </p>
            <p className="text-xs text-muted">{t("statMaxDrawdown")}</p>
          </div>
        </div>
      </div>

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
        <h2 className="font-medium">{t("reliabilitySectionTitle")}</h2>
        <div className="grid grid-cols-3 gap-3">
          <CircularGauge value={reliabilityScore} label={t("gaugeReliability")} statusText={reliabilityStatus} variant="reliability" />
          <CircularGauge value={safetyScore} label={t("gaugeSafety")} statusText={safetyStatus} variant="safety" />
          <CircularGauge value={riskExposureScore} label={t("gaugeRiskExposure")} statusText={riskStatus} variant="risk" />
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-success" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 12l2 2 4-4" />
              <circle cx="12" cy="12" r="9" />
            </svg>
            <div>
              <p className="text-sm font-semibold">{closedHistory.length}</p>
              <p className="text-[11px] text-muted">{t("closedTradesStat")}</p>
            </div>
          </div>
          <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            <div>
              <p className="text-sm font-semibold">{daysAsMember}</p>
              <p className="text-[11px] text-muted">{t("daysMemberStat")}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">{t("equityChartTitle")}</h2>
        <TraderEquityChart signals={allSignals} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">{t("periodsPerformanceTitle")}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {periods.map((p) => {
            const stats = periodStats(allSignals, p.days);
            return (
              <div key={p.labelKey} className="rounded-lg border border-border bg-surface p-3 text-center">
                <p className="text-xs text-muted">{tp(p.labelKey)}</p>
                <p
                  className={
                    stats.totalReturn != null && stats.totalReturn < 0
                      ? "text-lg font-semibold text-danger"
                      : "text-lg font-semibold text-success"
                  }
                >
                  {stats.totalReturn != null
                    ? `${stats.totalReturn > 0 ? "+" : ""}${stats.totalReturn}%`
                    : "—"}
                </p>
                <p className="text-xs text-muted">
                  {stats.winRate != null ? t("winRateInline", { pct: stats.winRate }) : t("noTradesLabel")}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {allSignals.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-medium">{t("assetsSectionTitle")}</h2>
          <AssetAllocationBar signals={allSignals} />
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">{t("openOrdersSectionTitle")}</h2>
        <OpenOrdersTable orders={openOrders} initialPrices={initialPrices} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">{t("tradeHistorySectionTitle")}</h2>
        {closedHistory.length === 0 ? (
          <p className="text-sm text-muted">{t("noClosedTrades")}</p>
        ) : (
          <TradeHistory trades={closedHistory} />
        )}
      </section>
      </main>
    </>
  );
}
