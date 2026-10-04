import { getMoney } from "@/lib/money-server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { followProvider, unfollowProvider } from "@/app/discover/actions";
import { FollowButton } from "@/components/FollowButton";
import { AppNav } from "@/components/AppNav";
import { TraderTradeHistory, type HistoryTrade } from "@/components/TraderTradeHistory";
import { getGaugeTier } from "@/components/CircularGauge";
import { ExnessReliabilitySection } from "@/components/ExnessReliabilitySection";
import { computeReliabilityTimeline, computeActiveTradingDays } from "@/lib/reliability";
import { AssetAllocationBar } from "@/components/AssetAllocationBar";
import { MonthlyReturnsCalendar } from "@/components/MonthlyReturnsCalendar";
import { OpenOrdersTable } from "@/components/OpenOrdersTable";
import { TraderAvatar } from "@/components/TraderAvatar";
import { countryDisplay } from "@/lib/country-metadata";
import { formatDate } from "@/lib/locale-format";
import { computeStats } from "@/lib/provider-stats";
import { resolveLevels, tradeProfitUsd, tradeReturnPct } from "@/lib/pip-specs";
import { CopyBar } from "@/components/CopyBar";
import { CopyDialog } from "@/components/CopyDialog";
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
  lot_size: number | null;
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

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("traderProfileTitle"), description: t("traderProfileDesc") };
}

export default async function TraderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string; tab?: string }>;
}) {
  const { id } = await params;
  const { error, success, tab } = await searchParams;
  const TABS = ["history", "performance", "openTrades", "allocation"] as const;
  const activeTab: (typeof TABS)[number] = (TABS as readonly string[]).includes(tab ?? "") ? (tab as (typeof TABS)[number]) : "history";
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("TraderProfile");
  const money = await getMoney();
  const tp = await getTranslations("TradeHistory");
  const tc = await getTranslations("Countries");
  const tdAct = await getTranslations("Actions.discover");
  const translateBio = await getBioTranslator();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: initialProvider }, { data: signals }, { data: mySub }, { data: myProfile }, { data: myFollow }] = await Promise.all([
    supabase.from("provider_cards").select("*").eq("provider_id", id).single(),
    supabase
      .from("signals")
      .select("id, symbol, side, entry_price, exit_price, stop_loss, take_profit, status, opened_at, closed_at, close_trigger, lot_size")
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
          .select("id, allocated_amount, max_drawdown_pct, copy_mode, fixed_amount, max_per_trade, tp_pct, sl_pct, trailing_pct")
          .eq("follower_id", user.id)
          .eq("provider_id", id)
          .eq("is_active", true)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    user
      ? supabase.from("profiles").select("balance").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
    user
      ? supabase.from("follows").select("provider_id").eq("follower_id", user.id).eq("provider_id", id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  let provider = initialProvider;
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
  // Any open copied trade locks the amount / mode / per-trade cap (enforced in the database).
  const { count: openCopiedCount } =
    user && mySub
      ? await supabase.from("simulated_positions").select("id", { count: "exact", head: true }).eq("subscription_id", mySub.id).eq("status", "open")
      : { count: 0 };
  const isWatching = !!myFollow;
  const maxDrawdown = computeMaxDrawdown(allSignals);
  // AUM = allocated amount of active copies on REAL accounts only, computed
  // in the database (provider_aum, 0195); 0 is shown as "—".
  const { data: aumRaw } = await supabase.rpc("provider_aum", { p_provider_id: id });
  const aum = Number(aumRaw ?? 0);
  // Leader-written strategy / risk text (lead_trader_profiles, 0213); only
  // self-service lead traders have a row, so this is null for everyone else.
  const { data: ltPublic } = await supabase.from("lead_trader_profiles").select("strategy_description, risk_disclosure").eq("provider_id", id).maybeSingle();
  const profitShare = provider.profit_share_pct != null ? Number(provider.profit_share_pct) : null;
  const extraStats = computeStats(
    allSignals.flatMap((s) =>
      s.status === "closed" && s.exit_price != null && s.closed_at
        ? [{ provider_id: id, side: s.side, entry_price: s.entry_price, exit_price: s.exit_price, opened_at: s.opened_at, closed_at: s.closed_at }]
        : [],
    ),
  );

  const closedHistory: HistoryTrade[] = allSignals
    .filter((s) => s.status === "closed" && s.exit_price != null)
    .map((s) => {
      const entry = Number(s.entry_price);
      const exit = Number(s.exit_price);
      const lot = s.lot_size != null ? Number(s.lot_size) : null;
      const { stopLoss, takeProfit } = resolveLevels(
        s.side,
        entry,
        s.stop_loss != null ? Number(s.stop_loss) : null,
        s.take_profit != null ? Number(s.take_profit) : null,
      );
      return {
        id: s.id,
        symbol: s.symbol,
        side: s.side,
        lot,
        entry,
        exit,
        pnl: tradeProfitUsd(s.symbol, s.side, entry, exit, lot),
        pct: tradeReturnPct(s.side, entry, exit),
        openedAt: s.opened_at,
        closedAt: s.closed_at,
        stopLoss,
        takeProfit,
        // No per-trade swap / commission is recorded; shown as "-".
        swap: null,
        commission: null,
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
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6 pb-[calc(var(--bottom-nav-h)+var(--copy-bar-h,7rem)+1rem)] lg:pb-6 lg:ms-64 lg:me-0">
        {error && (
          <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        {success === "saved" && (
          <p className="rounded border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">{tdAct("copySettingsSaved")}</p>
        )}

        {success === "started" && mySub && (
          <p className="rounded border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
            {t("copyStartedSuccess", {
              name: provider.display_name,
              amount: money(Number(mySub.allocated_amount)),
            })}
          </p>
        )}

      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <TraderAvatar providerId={id} name={provider.display_name} avatarUrl={provider.avatar_url} ratingScore={provider.rating_score} size={64} priority />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">{provider.display_name}</h1>
              {countryDisplay(provider.country) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`https://flagcdn.com/20x15/${provider.country!.toLowerCase()}.png`}
                  alt={tc(provider.country as never)}
                  width={20}
                  height={15}
                  className="inline-block rounded-[2px]"
                />
              )}
              {user ? (
                <FollowButton providerId={id} providerName={provider.display_name} initialWatching={isWatching} />
              ) : (
                <Link
                  href={`/signup?next=${encodeURIComponent(`/trader/${id}`)}`}
                  className="rounded-full border border-accent px-3 py-0.5 text-xs text-accent"
                >
                  {t("follow")}
                </Link>
              )}
            </div>
            {isWatching && (
              <p className="mt-0.5 text-[11px] text-muted">
                {t("followNotifyNote")}
              </p>
            )}
          </div>
        </div>

        {provider.bio && <p className="text-sm text-muted">{translateBio(provider.bio)}</p>}
        {ltPublic?.strategy_description && (
          <div className="rounded-xl border border-border bg-surface p-3">
            <p className="mb-1 text-xs font-semibold">{t("strategyTitle")}</p>
            <p className="whitespace-pre-line text-sm text-muted">{ltPublic.strategy_description}</p>
          </div>
        )}
        {ltPublic?.risk_disclosure && (
          <div className="rounded-xl border border-warning/30 bg-warning/5 p-3">
            <p className="mb-1 text-xs font-semibold text-warning">{t("riskDisclosureTitle")}</p>
            <p className="whitespace-pre-line text-sm text-muted">{ltPublic.risk_disclosure}</p>
          </div>
        )}

        {/* The primary copy action -- amount input + "نسخ" button. Fixed
            to the bottom of the viewport on phones so it's always
            reachable while scrolling; a normal inline bar right here,
            under the bio, from sm up. */}
        <CopyBar>
          {isStopped ? (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-3 text-center text-sm text-danger">
              {t("stoppedTradingNotice", { name: provider.display_name })}
            </p>
          ) : !user ? (
            <div className="flex flex-col gap-1.5">
              <Link
                href={`/signup?next=${encodeURIComponent(`/trader/${id}#copy`)}`}
                className="block rounded-lg bg-accent px-5 py-3 text-center text-base font-bold text-accent-foreground shadow-md shadow-accent/20 transition hover:bg-accent-hover"
              >
                {t("copyCta")}
              </Link>
              <p className="text-center text-xs text-muted">
                {t("minCopyBadgeLabel")} <span dir="ltr">{money(Number(provider.min_copy_amount))}</span>
              </p>
            </div>
          ) : isFollowing ? (
            <div className="flex items-center justify-between gap-3">
              <p className="flex min-w-0 items-center gap-2 text-sm">
                <span className="h-2 w-2 shrink-0 rounded-full bg-success" aria-hidden="true" />
                <span className="truncate">
                  {t("currentlyCopyingAmount", {
                    amount: money(Number(mySub?.allocated_amount ?? 0)),
                  })}
                </span>
              </p>
              <div className="flex shrink-0 items-center gap-2">
              <CopyDialog
                action={followProvider}
                providerId={id}
                providerName={provider.display_name}
                defaultAmount={Number(mySub?.allocated_amount ?? 0)}
                minAmount={Number(provider.min_copy_amount)}
                edit={{
                  mode: mySub?.copy_mode === "fixed" ? "fixed" : "ratio",
                  fixedAmount: mySub?.fixed_amount == null ? null : Number(mySub.fixed_amount),
                  maxPerTrade: mySub?.max_per_trade == null ? null : Number(mySub.max_per_trade),
                  stopLossPct: Number(mySub?.max_drawdown_pct ?? 50),
                  takeProfitPct: mySub?.tp_pct == null ? null : Number(mySub.tp_pct),
                  tradeStopLossPct: mySub?.sl_pct == null ? null : Number(mySub.sl_pct),
                  trailingPct: mySub?.trailing_pct == null ? null : Number(mySub.trailing_pct),
                  locked: (openCopiedCount ?? 0) > 0,
                }}
              />
              <form action={unfollowProvider}>
                <input type="hidden" name="providerId" value={id} />
                <input type="hidden" name="returnTo" value={`/trader/${id}`} />
                <button type="submit" className="shrink-0 rounded-lg border border-border px-4 py-2 text-sm">
                  {t("stopCopyingCta")}
                </button>
              </form>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <CopyDialog
                action={followProvider}
                providerId={id}
                providerName={provider.display_name}
                defaultAmount={Number(myProfile?.balance ?? provider.min_copy_amount)}
                minAmount={Number(provider.min_copy_amount)}
                profitSharePct={profitShare}
              />
              <p className="text-center text-xs text-muted">
                {t("minCopyBadgeLabel")} <span dir="ltr">{money(Number(provider.min_copy_amount))}</span>
              </p>
            </div>
          )}
        </CopyBar>

        <div className="grid grid-cols-2 gap-3 border-t border-slate-700/70 pt-4 text-center text-sm sm:grid-cols-3">
          <div>
            <p className="font-semibold">{provider.followers_count}</p>
            <p className="text-xs text-muted">{t("statCopiers")}</p>
          </div>
          <div>
            <p className={Number(provider.total_profit) >= 0 ? "font-semibold text-success" : "font-semibold text-danger"}>
              {money(Number(provider.total_profit), { signed: true, compact: true })}
            </p>
            <p className="text-xs text-muted">{t("statTotalProfit")}</p>
          </div>
          <div>
            <p className="font-semibold">
              {money(Number(provider.total_withdrawals), { compact: true })}
            </p>
            <p className="text-xs text-muted">{t("statTotalWithdrawals")}</p>
          </div>
          <div>
            <p className="font-semibold">
              {money(Number(provider.account_capital ?? 0), { compact: true })}
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
          <div>
            <p className="font-semibold" dir="ltr">
              {aum > 0 ? money(aum, { compact: true }) : "—"}
            </p>
            <p className="text-xs text-muted">{t("statAum")}</p>
          </div>
          {profitShare != null && (
            <div>
              <p className="font-semibold" dir="ltr">
                {profitShare}%
              </p>
              <p className="text-xs text-muted">{t("statProfitShare")}</p>
            </div>
          )}
          <div>
            <p className="font-semibold tabular-nums" dir="ltr">
              {extraStats.sharpe ?? "—"}
            </p>
            <p className="text-xs text-muted">{t("statSharpe")}</p>
          </div>
          <div>
            <p className="font-semibold tabular-nums" dir="ltr">
              {extraStats.avgDurationHours != null ? t("hoursShort", { hours: extraStats.avgDurationHours }) : "—"}
            </p>
            <p className="text-xs text-muted">{t("statAvgDuration")}</p>
          </div>
        </div>

        <div className="border-t border-slate-700/70 pt-4">
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

      <div className="flex gap-1 overflow-x-auto rounded-full border border-border bg-surface p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((key) => (
          <Link
            key={key}
            href={`/trader/${id}?tab=${key}`}
            className={
              activeTab === key
                ? "min-w-fit flex-1 whitespace-nowrap rounded-full bg-accent px-3 py-1.5 text-center text-sm font-medium text-accent-foreground"
                : "min-w-fit flex-1 whitespace-nowrap rounded-full px-3 py-1.5 text-center text-sm text-muted transition hover:text-foreground"
            }
          >
            {
              {
                performance: t("tab_performance"),
                openTrades: t("tab_openTrades"),
                history: t("tab_history"),
                allocation: t("tab_allocation"),
              }[key]
            }
          </Link>
        ))}
      </div>

      {activeTab === "performance" && (
        <section className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
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
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="font-medium">{t("monthlyReturnsTitle")}</h2>
            <MonthlyReturnsCalendar signals={allSignals} locale={locale} />
          </div>
        </section>
      )}

      {activeTab === "openTrades" && (
        <section className="flex flex-col gap-3">
          <OpenOrdersTable orders={openOrders} initialPrices={initialPrices} />
        </section>
      )}

      {activeTab === "history" && (
        <section className="flex flex-col gap-3">
          <p className="text-end text-xs text-slate-500">
            {t("memberSince", {
              date: formatDate(provider.joined_at, locale, { year: "numeric", month: "long", timeZone: "UTC" }),
            })}
          </p>
          {closedHistory.length === 0 ? (
            <p className="text-sm text-muted">{t("noClosedTrades")}</p>
          ) : (
            <TraderTradeHistory trades={closedHistory} />
          )}
        </section>
      )}

      {activeTab === "allocation" && (
        <section className="flex flex-col gap-3">
          {allSignals.length === 0 ? (
            <p className="text-sm text-muted">{t("noClosedTrades")}</p>
          ) : (
            <AssetAllocationBar signals={allSignals} />
          )}
        </section>
      )}
      </main>
    </>
  );
}
