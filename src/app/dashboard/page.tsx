import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { DashboardHero } from "@/components/DashboardHero";
import { MarketTicker } from "@/components/MarketTicker";
import { CopiedPositionsTable } from "@/components/CopiedPositionsTable";
import { ActiveCopyControlPanel } from "@/components/ActiveCopyControlPanel";
import { ConfirmButton } from "@/components/ConfirmButton";
import { OnboardingStepsCard } from "@/components/OnboardingStepsCard";
import { SuggestedTraders } from "@/components/SuggestedTraders";
import { RecentActivityTimeline, type ActivityEvent } from "@/components/RecentActivityTimeline";
import { PortfolioAllocationDonut } from "@/components/PortfolioAllocationDonut";
import { MostCopiedThisWeek } from "@/components/MostCopiedThisWeek";
import { chooseAccountType } from "@/app/auth/actions";

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("dashboardTitle"), description: t("dashboardDesc") };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const t = await getTranslations("Dashboard");
  const tNav = await getTranslations("Nav");
  const tMenu = await getTranslations("AccountMenu");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=%2Fdashboard");
  }

  const [{ data: profile }, { data: kyc }, { data: subscriptions }, { data: rawPositions }, { data: tickerPrices }, { data: walletRequests }] =
    await Promise.all([
      supabase.from("profiles").select("display_name, account_type, balance, country, account_number").eq("id", user.id).single(),
      supabase
        .from("kyc_submissions")
        .select("status")
        .eq("user_id", user.id)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("subscriptions")
        .select("id, provider_id, allocated_amount, max_drawdown_pct, copy_started_at")
        .eq("follower_id", user.id)
        .eq("is_active", true),
      supabase
        .from("simulated_positions")
        .select("id, subscription_id, status, pnl, entry_price, size, opened_at, closed_at, account_type, signals(symbol, side)")
        .eq("follower_id", user.id),
      supabase.from("market_prices").select("symbol, price").in("symbol", ["BTCUSDT", "XAUUSD", "EURUSD"]),
      supabase
        .from("wallet_requests")
        .select("id, type, amount, status, requested_at")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .order("requested_at", { ascending: false })
        .limit(5),
    ]);

  // Demo and real stats never mix: only positions opened on the active account.
  const positions = (rawPositions ?? []).filter((p) => p.account_type === (profile?.account_type === "real" ? "real" : "demo"));

  const tickerInitialPrices = Object.fromEntries((tickerPrices ?? []).map((p) => [p.symbol, Number(p.price)]));

  const providerIds = (subscriptions ?? []).map((s) => s.provider_id);
  const allocationByProvider = new Map((subscriptions ?? []).map((s) => [s.provider_id, s.allocated_amount]));
  const totalAllocated = Array.from(allocationByProvider.values()).reduce((sum, a) => sum + Number(a), 0);

  const { data: followedProviders } =
    providerIds.length > 0
      ? await supabase
          .from("provider_cards")
          .select("provider_id, display_name, win_rate_pct, avg_daily_return_pct, avatar_url, rating_score")
          .in("provider_id", providerIds)
      : { data: [] as never[] };

  type PositionSignal = { symbol: string; side: string };
  type DashPosition = {
    id: string;
    subscription_id: string;
    status: string;
    pnl: number | null;
    entry_price: number;
    size: number;
    opened_at: string;
    closed_at: string | null;
    signals: PositionSignal | PositionSignal[] | null;
  };
  const positionSignal = (p: DashPosition): PositionSignal | null =>
    Array.isArray(p.signals) ? p.signals[0] ?? null : p.signals;

  const allPositions = (positions ?? []) as DashPosition[];
  const openPositions = allPositions.filter((p) => p.status === "open");
  const closedPositions = allPositions.filter((p) => p.status === "closed");
  const openPositionsCount = openPositions.length;
  const netPnl = closedPositions.reduce((sum, p) => sum + (p.pnl ?? 0), 0);
  const now = new Date();
  const todayUtcStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const todayPnl = closedPositions
    .filter((p) => p.closed_at && new Date(p.closed_at).getTime() >= todayUtcStart)
    .reduce((sum, p) => sum + (p.pnl ?? 0), 0);

  // Same threshold auto_stop_copy checks server-side (0168): cumulative
  // closed pnl per subscription vs -(allocated * maxDrawdownPct / 100).
  const cumulativePnlBySubscription = new Map<string, number>();
  for (const p of closedPositions) {
    cumulativePnlBySubscription.set(p.subscription_id, (cumulativePnlBySubscription.get(p.subscription_id) ?? 0) + (p.pnl ?? 0));
  }
  // A customer can copy several traders at once now, so this is a list
  // (was a single "activeSubscription" before multi-copy support).
  const copiedProviders = (subscriptions ?? []).flatMap((sub) => {
    const providerCard = (followedProviders ?? []).find((p) => p.provider_id === sub.provider_id);
    if (!providerCard) return [];
    return [
      {
        subscriptionId: sub.id,
        providerId: sub.provider_id,
        displayName: providerCard.display_name,
        avatarUrl: providerCard.avatar_url,
        ratingScore: providerCard.rating_score,
        allocatedAmount: Number(sub.allocated_amount),
        maxDrawdownPct: Number(sub.max_drawdown_pct),
        cumulativePnl: cumulativePnlBySubscription.get(sub.id) ?? 0,
      },
    ];
  });

  const openSymbols = Array.from(
    new Set(openPositions.map((p) => positionSignal(p)?.symbol).filter((s): s is string => !!s)),
  );
  const { data: livePrices } =
    openSymbols.length > 0
      ? await supabase.from("market_prices").select("symbol, price").in("symbol", openSymbols)
      : { data: [] as { symbol: string; price: number }[] };
  const priceBySymbol = new Map((livePrices ?? []).map((p) => [p.symbol, Number(p.price)]));

  const totalUnrealizedPnl = openPositions.reduce((sum, pos) => {
    const signal = positionSignal(pos);
    const current = signal ? priceBySymbol.get(signal.symbol) : undefined;
    if (current == null || !signal) return sum;
    const pct = ((current - pos.entry_price) / pos.entry_price) * (signal.side === "sell" ? -1 : 1);
    return sum + pct * Number(pos.size);
  }, 0);

  // Merges positions/copy-starts/wallet activity into one feed, newest
  // first, for the "recent activity" timeline -- provider names come from
  // the customer's own currently-active copies (good enough for a demo
  // feed of recent events; a copy stopped since then just shows without a
  // name rather than a wrong or stale one).
  const providerNameBySubscription = new Map(copiedProviders.map((p) => [p.subscriptionId, p.displayName]));
  const activityEvents: ActivityEvent[] = [
    ...openPositions.map((p) => ({
      id: `open-${p.id}`,
      type: "position_opened" as const,
      at: p.opened_at,
      symbol: positionSignal(p)?.symbol,
    })),
    ...closedPositions
      .filter((p) => p.closed_at)
      .map((p) => ({
        id: `close-${p.id}`,
        type: (p.pnl ?? 0) >= 0 ? ("position_closed_win" as const) : ("position_closed_loss" as const),
        at: p.closed_at as string,
        symbol: positionSignal(p)?.symbol,
      })),
    ...(subscriptions ?? [])
      .filter((s) => s.copy_started_at)
      .map((s) => ({
        id: `copy-${s.id}`,
        type: "copy_started" as const,
        at: s.copy_started_at as string,
        providerName: providerNameBySubscription.get(s.id),
      })),
    ...(profile?.account_type === "real" ? (walletRequests ?? []) : []).map((w) => ({
      id: `wallet-${w.id}`,
      type: w.type === "deposit" ? ("deposit" as const) : ("withdrawal" as const),
      at: w.requested_at,
      amount: Number(w.amount),
    })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 8);

  const allocationSlices = [
    ...copiedProviders.map((p) => ({ label: p.displayName, value: p.allocatedAmount })),
    { label: t("allocationAvailableCash"), value: Math.max(0, Number(profile?.balance ?? 0) - totalAllocated) },
  ];

  const kycCopyByStatus: Record<string, { title: string; desc: string; action?: string }> = {
    none: { title: t("kycNoneTitle"), desc: t("kycNoneDesc"), action: t("kycNoneAction") },
    pending: { title: t("kycPendingTitle"), desc: t("kycPendingDesc") },
    rejected: { title: t("kycRejectedTitle"), desc: t("kycRejectedDesc"), action: t("kycRejectedAction") },
  };

  const kycStatus = kyc?.status ?? "none";
  const accountType: "real" | "demo" = profile?.account_type === "real" ? "real" : "demo";
  // One smart banner at a time: the demo account gets a "switch to real"
  // nudge instead of the KYC banner, which only makes sense for real
  // accounts (demo money never needs identity verification).
  const kycCopy =
    accountType === "real" && kycStatus !== "approved" ? kycCopyByStatus[kycStatus] ?? kycCopyByStatus.none : null;
  const showDemoBanner = accountType === "demo";

  const hour = new Date().getHours();
  const greetingName = profile?.display_name ?? user.email ?? "";
  const greeting = hour >= 5 && hour < 18 ? t("greetingMorning", { name: greetingName }) : t("greetingEvening", { name: greetingName });

  return (
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6 pb-[calc(var(--bottom-nav-h)+1.5rem)] lg:ms-64 lg:me-0 lg:pb-6">
        <MarketTicker initialPrices={tickerInitialPrices} />

        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-page-title">{greeting}</h1>
          {profile?.account_type && (
            <span
              className={
                profile.account_type === "real"
                  ? "rounded-full border border-success/40 bg-success/10 px-3 py-1 text-xs font-semibold text-success"
                  : "rounded-full border border-warning/40 bg-warning/10 px-3 py-1 text-xs font-semibold text-warning"
              }
            >
              {profile.account_type === "real" ? t("accountReal") : t("accountDemo")}
            </span>
          )}
          {profile?.account_number != null && (
            <span className="text-xs text-muted" dir="ltr">
              {tMenu("accountNumber")} <span className="font-mono text-foreground/80">#{profile.account_number}</span>
            </span>
          )}
        </div>

        {error && (
          <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
        )}

        {showDemoBanner && (
          <div className="flex flex-col gap-4 rounded-2xl border border-accent/30 bg-accent/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/15">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium">{t("demoBannerTitle")}</p>
                <p className="mt-0.5 text-xs text-muted">{t("demoBannerDesc")}</p>
              </div>
            </div>
            <form action={chooseAccountType} className="shrink-0">
              <input type="hidden" name="accountType" value="real" />
              <input type="hidden" name="next" value="/dashboard" />
              <ConfirmButton
                confirmText={tNav("switchAccountWarning")}
                className="rounded-lg bg-accent px-4 py-2 text-center text-sm font-semibold text-accent-foreground transition hover:bg-accent-hover"
              >
                {t("demoBannerAction")}
              </ConfirmButton>
            </form>
          </div>
        )}

        {kycCopy && (
          <div className="flex flex-col gap-4 rounded-2xl border border-warning/30 bg-warning/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-warning/15">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-warning" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium">{kycCopy.title}</p>
                <p className="mt-0.5 text-xs text-muted">{kycCopy.desc}</p>
              </div>
            </div>
            {kycCopy.action && (
              <div className="flex shrink-0 gap-2">
                <Link
                  href="/kyc"
                  className="rounded-lg bg-warning px-4 py-2 text-center text-sm font-semibold text-background transition hover:brightness-110"
                >
                  {kycCopy.action}
                </Link>
                <Link
                  href="/kyc/steps"
                  className="rounded-lg border border-border px-4 py-2 text-center text-sm text-foreground transition hover:border-accent hover:text-accent"
                >
                  {t("learnMore")}
                </Link>
              </div>
            )}
          </div>
        )}

        <DashboardHero
          accountType={accountType}
          balance={Number(profile?.balance ?? 0)}
          totalAllocated={totalAllocated}
          totalUnrealizedPnl={totalUnrealizedPnl}
          totalRealizedPnl={netPnl}
          todayPnl={todayPnl}
          closedPositions={closedPositions.map((p) => ({ pnl: p.pnl, closed_at: p.closed_at }))}
        />

        <section className="grid grid-cols-3 rounded-2xl border border-border bg-surface">
          {[
            {
              value: String(providerIds.length),
              label: t("followedTraders"),
              tone: "",
              icon: (
                <>
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </>
              ),
            },
            {
              value: String(openPositionsCount),
              label: t("openPositions"),
              tone: "",
              icon: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />,
            },
            {
              value: `${netPnl >= 0 ? "+" : "-"}$${Math.abs(netPnl).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              label: t("netRealizedProfit"),
              tone: netPnl >= 0 ? "text-success" : "text-danger",
              icon: (
                <>
                  <path d="M23 6l-9.5 9.5-5-5L1 18" />
                  <path d="M17 6h6v6" />
                </>
              ),
            },
          ].map((kpi) => (
            <div key={kpi.label} className="flex flex-col items-center gap-1 border-s border-border px-2 py-4 text-center first:border-s-0">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {kpi.icon}
              </svg>
              <p className={`text-lg font-semibold ${kpi.tone}`} dir="ltr">
                {kpi.value}
              </p>
              <p className="text-xs text-muted">{kpi.label}</p>
            </div>
          ))}
        </section>

        <section id="my-copies" className="flex flex-col gap-3 scroll-mt-20">
          {copiedProviders.length > 0 && (
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">{t("traderYouCopy")}</h2>
              <Link href="/copies" className="text-sm text-accent hover:underline">
                {tNav("viewAll")}
              </Link>
            </div>
          )}

          {copiedProviders.length === 0 ? (
            <OnboardingStepsCard
              profileComplete={!!profile?.country}
              protectionReady={accountType === "demo" || kycStatus === "approved"}
            />
          ) : (
            <div className="flex flex-col gap-3">
              {copiedProviders.map((provider) => (
                <ActiveCopyControlPanel key={provider.subscriptionId} provider={provider} />
              ))}
            </div>
          )}
        </section>

        {copiedProviders.length === 0 && <SuggestedTraders excludeProviderIds={providerIds} />}

        {copiedProviders.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">{t("copiedPositionsTitle")}</h2>
            <div className="rounded-2xl border border-slate-800 bg-surface p-5">
              <CopiedPositionsTable
                positions={openPositions.map((p) => {
                  const signal = positionSignal(p);
                  return {
                    id: p.id,
                    symbol: signal?.symbol ?? "",
                    side: signal?.side ?? "buy",
                    entry_price: p.entry_price,
                    size: p.size,
                    traderName: providerNameBySubscription.get(p.subscription_id) ?? "",
                  };
                })}
                limit={5}
                viewAllHref="/trades"
              />
            </div>
          </section>
        )}

        {copiedProviders.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">{t("portfolioAllocationTitle")}</h2>
            <div className="rounded-2xl border border-border bg-surface p-5">
              <PortfolioAllocationDonut
                slices={allocationSlices}
                totalLabel={t("portfolioValue")}
                totalValue={Number(profile?.balance ?? 0)}
              />
            </div>
          </section>
        )}

        {copiedProviders.length > 0 && <RecentActivityTimeline events={activityEvents} />}

        <MostCopiedThisWeek />

        <p className="text-center text-xs text-muted">{t("riskDisclaimerLine")}</p>
      </main>
    </>
  );
}
