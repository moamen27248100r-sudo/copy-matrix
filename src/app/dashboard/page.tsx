import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { DashboardHero } from "@/components/DashboardHero";
import { MyEquityChart } from "@/components/MyEquityChart";
import { MarketTicker } from "@/components/MarketTicker";
import { CopiedPositionsTable } from "@/components/CopiedPositionsTable";
import { ActiveCopyControlPanel } from "@/components/ActiveCopyControlPanel";

const QUICK_LINK_ICONS = {
  discover: (
    <>
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </>
  ),
  portfolio: (
    <>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </>
  ),
  kyc: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const t = await getTranslations("Dashboard");
  const tNav = await getTranslations("Nav");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: kyc }, { data: subscriptions }, { data: positions }, { data: tickerPrices }] =
    await Promise.all([
      supabase.from("profiles").select("display_name, account_type, balance").eq("id", user.id).single(),
      supabase
        .from("kyc_submissions")
        .select("status")
        .eq("user_id", user.id)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("subscriptions")
        .select("id, provider_id, allocated_amount, max_drawdown_pct")
        .eq("follower_id", user.id)
        .eq("is_active", true),
      supabase
        .from("simulated_positions")
        .select("id, subscription_id, status, pnl, entry_price, size, closed_at, signals(symbol, side)")
        .eq("follower_id", user.id),
      supabase.from("market_prices").select("symbol, price").in("symbol", ["BTCUSDT", "XAUUSD", "EURUSD"]),
    ]);

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

  // Same threshold auto_stop_copy checks server-side (0168): cumulative
  // closed pnl per subscription vs -(allocated * maxDrawdownPct / 100).
  const cumulativePnlBySubscription = new Map<string, number>();
  for (const p of closedPositions) {
    cumulativePnlBySubscription.set(p.subscription_id, (cumulativePnlBySubscription.get(p.subscription_id) ?? 0) + (p.pnl ?? 0));
  }
  const activeSubscription = (subscriptions ?? [])[0];
  const activeProviderCard = activeSubscription
    ? (followedProviders ?? []).find((p) => p.provider_id === activeSubscription.provider_id)
    : undefined;
  const copiedProvider =
    activeSubscription && activeProviderCard
      ? {
          providerId: activeSubscription.provider_id,
          displayName: activeProviderCard.display_name,
          avatarUrl: activeProviderCard.avatar_url,
          ratingScore: activeProviderCard.rating_score,
          allocatedAmount: Number(activeSubscription.allocated_amount),
          maxDrawdownPct: Number(activeSubscription.max_drawdown_pct),
          cumulativePnl: cumulativePnlBySubscription.get(activeSubscription.id) ?? 0,
        }
      : null;

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

  const kycCopyByStatus: Record<string, { title: string; desc: string; action?: string }> = {
    none: { title: t("kycNoneTitle"), desc: t("kycNoneDesc"), action: t("kycNoneAction") },
    pending: { title: t("kycPendingTitle"), desc: t("kycPendingDesc") },
    rejected: { title: t("kycRejectedTitle"), desc: t("kycRejectedDesc"), action: t("kycRejectedAction") },
  };
  const quickLinks = [
    { href: "/discover", title: t("quickLinkDiscoverTitle"), desc: t("quickLinkDiscoverDesc"), icon: QUICK_LINK_ICONS.discover },
    { href: "/portfolio", title: t("quickLinkPortfolioTitle"), desc: t("quickLinkPortfolioDesc"), icon: QUICK_LINK_ICONS.portfolio },
    { href: "/kyc", title: t("quickLinkKycTitle"), desc: t("quickLinkKycDesc"), icon: QUICK_LINK_ICONS.kyc },
    { href: "/settings", title: t("quickLinkSettingsTitle"), desc: t("quickLinkSettingsDesc"), icon: QUICK_LINK_ICONS.settings },
  ];

  const kycStatus = kyc?.status ?? "none";
  const kycCopy = kycStatus === "approved" ? null : kycCopyByStatus[kycStatus] ?? kycCopyByStatus.none;
  // Once verified, the identity-verification tile is just noise.
  const visibleQuickLinks = quickLinks.filter((l) => !(l.href === "/kyc" && kycStatus === "approved"));

  return (
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
        <MarketTicker initialPrices={tickerInitialPrices} />

        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-xl font-semibold">
              {t("greeting", { name: profile?.display_name ?? user.email ?? "" })}
            </h1>
            <p className="text-sm text-muted">{user.email}</p>
          </div>
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
        </div>

        {error && (
          <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
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
          accountType={(profile?.account_type as "real" | "demo") ?? "demo"}
          balance={Number(profile?.balance ?? 0)}
          totalAllocated={totalAllocated}
          totalUnrealizedPnl={totalUnrealizedPnl}
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

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">{t("traderYouCopy")}</h2>
            {copiedProvider && (
              <Link href="/portfolio" className="text-sm text-accent hover:underline">
                {tNav("viewAll")}
              </Link>
            )}
          </div>

          {!copiedProvider ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-800 bg-surface/50 p-6 text-center">
              <p className="text-sm text-muted">{t("noCopyYet")}</p>
              <Link
                href="/discover"
                className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-accent-foreground transition hover:bg-accent-hover"
              >
                {t("browseTraders")}
              </Link>
            </div>
          ) : (
            <ActiveCopyControlPanel provider={copiedProvider} />
          )}
        </section>

        {copiedProvider && (
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
                  };
                })}
              />
            </div>
          </section>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">{t("portfolioPerformance")}</h2>
          <div className="rounded-2xl border border-border bg-surface p-5">
            {closedPositions.length === 0 ? (
              <div className="flex flex-col items-center gap-1 py-6 text-center">
                <p className="text-sm font-medium">{t("noClosedTrades")}</p>
                <p className="text-xs text-muted">{t("equityWillAppear")}</p>
              </div>
            ) : (
              <MyEquityChart positions={closedPositions.map((p) => ({ pnl: p.pnl, closed_at: p.closed_at }))} />
            )}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">{t("quickAccess")}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {visibleQuickLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 transition hover:border-accent/40 hover:shadow-lg"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {l.icon}
                </svg>
                <p className="text-sm font-medium">{l.title}</p>
                <p className="text-xs leading-relaxed text-muted">{l.desc}</p>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
