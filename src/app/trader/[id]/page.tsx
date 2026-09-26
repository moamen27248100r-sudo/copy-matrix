import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { followProvider, unfollowProvider, followTrader, unfollowTrader } from "@/app/discover/actions";
import { AppNav } from "@/components/AppNav";
import { TierBadge, RiskBadge } from "@/components/TraderBadges";
import { TradeHistory } from "@/components/TradeHistory";
import { getGaugeTier } from "@/components/CircularGauge";
import { ExnessReliabilitySection } from "@/components/ExnessReliabilitySection";
import { computeReliabilityTimeline, computeActiveTradingDays } from "@/lib/reliability";
import { AssetAllocationBar } from "@/components/AssetAllocationBar";
import { OpenOrdersTable } from "@/components/OpenOrdersTable";
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
  close_trigger: string | null;
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

  // Compounds each trade's % return against a running equity multiplier
  // instead of naively summing percentages -- the additive version could
  // (and, checked live, regularly did) report an impossible >100% or
  // even >1000% drawdown once per-trade swings got large enough (a
  // string of double-digit losses adds up past -100% on paper even
  // though real equity can only ever asymptotically approach zero,
  // never cross it). This can never mathematically exceed 100%.
  let equity = 1;
  let peak = 1;
  let maxDrawdown = 0;
  for (const s of closed) {
    const raw = (s.exit_price! - s.entry_price) / s.entry_price;
    const signed = s.side === "sell" ? -raw : raw;
    equity *= 1 + signed;
    if (equity > peak) peak = equity;
    const drawdown = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
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

  let [{ data: provider }, { data: signals }, { data: mySub }, { data: myProfile }, { data: otherSub }, { data: myFollow }] = await Promise.all([
    supabase.from("provider_cards").select("*").eq("provider_id", id).single(),
    supabase
      .from("signals")
      .select("id, symbol, side, entry_price, exit_price, stop_loss, take_profit, status, opened_at, closed_at, close_trigger")
      .eq("provider_id", id)
      // created_by_admin signals are per-customer trades (manual corrections,
      // margin calls, and the density-mechanic phantom positions below) --
      // they belong to that one customer's own view, not the leader's public
      // track record.
      .eq("created_by_admin", false)
      .order("opened_at", { ascending: false }),
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

  const reliabilityTimeline = computeReliabilityTimeline(allSignals);
  const latestReliabilityPoint = reliabilityTimeline[reliabilityTimeline.length - 1];
  const reliabilityScore = latestReliabilityPoint?.reliability ?? Number(provider.rating_score ?? 50);
  const safetyScore =
    latestReliabilityPoint?.safety ??
    Math.max(0, Math.min(100, Math.round(100 - Number(provider.return_volatility ?? 2) * 15)));
  const riskExposureScore =
    latestReliabilityPoint?.risk ??
    (maxDrawdown != null ? Math.max(0, Math.min(100, Math.round(maxDrawdown * 8))) : 20);
  const limitScore = latestReliabilityPoint?.limitScore ?? 0;
  const activeTradingDays = computeActiveTradingDays(allSignals);

  const STATUS_KEYS = {
    reliability: { low: "reliabilityStatusLow", medium: "reliabilityStatusMedium", high: "reliabilityStatusHigh" },
  } as const;
  const reliabilityStatus = t(STATUS_KEYS.reliability[getGaugeTier(reliabilityScore, "reliability")]);

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

      <div className="flex flex-col gap-4 rounded-2xl border border-slate-800/60 bg-[#0b1222] p-4 sm:p-5">
        <div className="flex items-center gap-4">
          <TraderAvatar providerId={id} name={provider.display_name} avatarUrl={provider.avatar_url} ratingScore={provider.rating_score} size={64} priority />
          <div className="min-w-0 flex-1">
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
            {isWatching && (
              <p className="mt-0.5 text-[11px] text-muted">
                {t("followNotifyNote")}
              </p>
            )}
          </div>
          {isStopped ? (
            <span className="shrink-0 cursor-not-allowed rounded-lg bg-border px-4 py-2 text-sm font-semibold text-muted">
              {t("copyCta")}
            </span>
          ) : (
            <Link
              href={user ? "#copy" : `/signup?next=${encodeURIComponent(`/trader/${id}#copy`)}`}
              className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-md shadow-accent/20 transition hover:bg-accent-hover"
            >
              {t("copyCta")}
            </Link>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <TierBadge tier={provider.tier} />
          <RiskBadge level={provider.risk_level} />
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-foreground/5 px-2 py-0.5 text-xs font-medium text-muted">
            {countryDisplay(provider.country) && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://flagcdn.com/16x12/${provider.country!.toLowerCase()}.png`}
                  alt=""
                  width={16}
                  height={12}
                  className="inline-block rounded-[1px]"
                />
                {tc(provider.country as never)}
                {" · "}
              </>
            )}
            {t("memberSince", {
              date: formatDate(provider.joined_at, locale, { year: "numeric", month: "long", timeZone: "UTC" }),
            })}
          </span>
        </div>

        {provider.bio && <p className="text-sm text-muted">{translateBio(provider.bio)}</p>}

        {user && (
        <div id="copy" className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3 scroll-mt-20">
          {isStopped ? (
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
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-full border border-slate-700/50 bg-slate-800/80 px-2.5 py-1 text-xs font-semibold text-foreground">
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

        <div className="grid grid-cols-2 gap-3 border-t border-slate-800/40 pt-4 text-center text-sm sm:grid-cols-3">
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

        <div className="border-t border-slate-800/40 pt-4">
          <ExnessReliabilitySection
            reliabilityScore={reliabilityScore}
            reliabilityStatus={reliabilityStatus}
            safetyScore={safetyScore}
            riskExposureScore={riskExposureScore}
            limitScore={limitScore}
            activeTradingDays={activeTradingDays}
            signals={allSignals}
          />
        </div>
      </div>

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
