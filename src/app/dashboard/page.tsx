import { getMoney } from "@/lib/money-server";
import { AppMain } from "@/components/AppMain";
import { depositsEnabled } from "@/lib/deposits-enabled";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUserTimeZone } from "@/lib/timezone";
import { AppNav } from "@/components/AppNav";
import { OnboardingStepsCard } from "@/components/OnboardingStepsCard";
import { TopTradersWeek } from "@/components/TopTradersWeek";
import { HomeWatchlist } from "@/components/HomeWatchlist";
import { LearnCards } from "@/components/LearnCards";
import { RecentActivityTimeline, type ActivityEvent } from "@/components/RecentActivityTimeline";
import { TopMovers } from "@/components/TopMovers";
import { QuickActions } from "@/components/home/QuickActions";
import { CopiesPerformance } from "@/components/home/CopiesPerformance";
import { HomeNews } from "@/components/home/HomeNews";
import { WhatsNew } from "@/components/home/WhatsNew";
import { RiskFooter } from "@/components/RiskFooter";
import { Skeleton } from "@/components/ui/Skeleton";
import { FlashMessage } from "@/components/ui/Toast";

function SectionSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
}

// Request time, read once per render: the start of the rolling 24-hour window on the summary card.
function since24h() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("dashboardTitle"), description: t("dashboardDesc") };
}

// The home page is a quick summary, nothing more: the wallet value (a link to the wallet), the
// first-steps checklist until it is done, the top three active copies, recent activity, suggested
// traders and the day's biggest movers. The balance card and its chart live in the wallet, the
// trades in "Trades", the copies' management in "Copies".
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const t = await getTranslations("Dashboard");
  const money = await getMoney();
  const tNav = await getTranslations("Nav");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=%2Fdashboard");
  }

  const timeZone = await getUserTimeZone();

  const [
    { data: profile },
    { data: kyc },
    { data: subscriptions },
    { data: summaryRaw },
    { data: rawOpen },
    { data: rawRecentClosed },
    { data: walletRequests },
    depositsOn,
    { count: prefsCount },
    { count: everCopied },
    { data: closed24h },
    { data: watchRows },
  ] = await Promise.all([
    supabase.from("profiles").select("account_type, balance, country").eq("id", user.id).single(),
    supabase
      .from("kyc_submissions")
      .select("status")
      .eq("user_id", user.id)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("subscriptions")
      .select("id, provider_id, allocated_amount, copy_started_at")
      .eq("follower_id", user.id)
      .eq("is_active", true),
    // Every total on this page is computed by the database in one call (migration 0254).
    supabase.rpc("dashboard_summary", { p_tz: timeZone }),
    supabase
      .from("simulated_positions")
      .select("id, subscription_id, status, pnl, opened_at, closed_at, account_type, signals(symbol, side)")
      .eq("follower_id", user.id)
      .eq("status", "open")
      .order("opened_at", { ascending: false })
      .limit(20),
    supabase
      .from("simulated_positions")
      .select("id, subscription_id, status, pnl, opened_at, closed_at, account_type, signals(symbol, side)")
      .eq("follower_id", user.id)
      .eq("status", "closed")
      .order("closed_at", { ascending: false })
      .limit(20),
    // Completed real-wallet movements for the activity feed.
    Promise.all([
      supabase
        .from("crypto_deposits")
        .select("id, amount, completed_at")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(5),
      supabase
        .from("crypto_withdrawals")
        .select("id, net_amount, completed_at")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(5),
    ]).then(([deposits, withdrawals]) => ({
      data: [
        ...(deposits.data ?? []).map((d) => ({ id: d.id, type: "deposit", amount: d.amount, requested_at: d.completed_at as string })),
        ...(withdrawals.data ?? []).map((w) => ({ id: w.id, type: "withdrawal", amount: w.net_amount, requested_at: w.completed_at as string })),
      ],
    })),
    depositsEnabled(supabase),
    // Saved notification preferences: the "turn on alerts" step is done once they were visited and saved.
    supabase.from("notification_preferences").select("category", { count: "exact", head: true }).eq("user_id", user.id),
    // Any copy ever started counts for the "first copy" step (a finished one too).
    supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("follower_id", user.id),
    // Copied trades closed in the last 24 hours: the summary card's result for the day.
    supabase
      .from("simulated_positions")
      .select("pnl, account_type")
      .eq("follower_id", user.id)
      .eq("status", "closed")
      .gte("closed_at", since24h()),
    supabase.from("market_watchlist").select("symbol").eq("user_id", user.id),
  ]);

  type ProviderResult = {
    provider_id: string;
    display_name: string | null;
    avatar_url: string | null;
    rating_score: number | null;
    allocated: number;
    realized: number;
    unrealized: number;
    total: number;
    open_count?: number;
  };
  type Summary = { open: { count: number; unrealized: number }; by_provider: ProviderResult[] };
  const summary = (summaryRaw ?? null) as Summary | null;
  const byProvider = summary?.by_provider ?? [];
  const unrealized = Number(summary?.open?.unrealized ?? 0);

  const activeType: "real" | "demo" = profile?.account_type === "real" ? "real" : "demo";
  const providerIds = (subscriptions ?? []).map((s) => s.provider_id);
  const walletValue = Number(profile?.balance ?? 0) + unrealized;
  const investedInCopies = (subscriptions ?? []).reduce((sum, s) => sum + Number(s.allocated_amount ?? 0), 0);
  const availableCash = Math.max(0, Number(profile?.balance ?? 0) - investedInCopies);
  const result24h = ((closed24h ?? []) as { pnl: number | null; account_type: string }[])
    .filter((r) => r.account_type === activeType)
    .reduce((sum, r) => sum + Number(r.pnl ?? 0), 0);
  const openCount = Number(summary?.open?.count ?? 0);

  type PositionSignal = { symbol: string; side: string };
  type DashPosition = {
    id: string;
    subscription_id: string;
    pnl: number | null;
    opened_at: string;
    closed_at: string | null;
    account_type: string;
    signals: PositionSignal | PositionSignal[] | null;
  };
  const symbolOf = (p: DashPosition): string | undefined => (Array.isArray(p.signals) ? p.signals[0] : p.signals)?.symbol;
  const openPositions = ((rawOpen ?? []) as unknown as DashPosition[]).filter((p) => p.account_type === activeType);
  const recentClosed = ((rawRecentClosed ?? []) as unknown as DashPosition[]).filter((p) => p.account_type === activeType);

  // The top three active copies: by the amount put into them.
  const copies = (subscriptions ?? [])
    .flatMap((sub) => {
      const row = byProvider.find((p) => p.provider_id === sub.provider_id);
      if (!row) return [];
      return [
        {
          subscriptionId: sub.id,
          providerId: sub.provider_id,
          name: row.display_name ?? "",
          avatarUrl: row.avatar_url,
          rating: row.rating_score,
          allocated: Number(sub.allocated_amount),
          total: Number(row.total),
        },
      ];
    })
    .sort((a, b) => b.allocated - a.allocated);
  const providerNameBySubscription = new Map(copies.map((c) => [c.subscriptionId, c.name]));

  const activityEvents: ActivityEvent[] = [
    ...openPositions.map((p) => ({
      id: `open-${p.id}`,
      type: "position_opened" as const,
      at: p.opened_at,
      symbol: symbolOf(p),
    })),
    ...recentClosed
      .filter((p) => p.closed_at)
      .map((p) => ({
        id: `close-${p.id}`,
        type:
          (p.pnl ?? 0) > 0 ? ("position_closed_win" as const) : (p.pnl ?? 0) < 0 ? ("position_closed_loss" as const) : ("position_closed_flat" as const),
        at: p.closed_at as string,
        symbol: symbolOf(p),
      })),
    ...(subscriptions ?? [])
      .filter((s) => s.copy_started_at)
      .map((s) => ({
        id: `copy-${s.id}`,
        type: "copy_started" as const,
        at: s.copy_started_at as string,
        providerName: providerNameBySubscription.get(s.id),
      })),
    ...(activeType === "real" ? (walletRequests ?? []) : []).map((w) => ({
      id: `wallet-${w.id}`,
      type: w.type === "deposit" ? ("deposit" as const) : ("withdrawal" as const),
      at: w.requested_at,
      amount: Number(w.amount),
    })),
  ]
    .sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime())
    .slice(0, 6);

  const kycCopyByStatus: Record<string, { title: string; desc: string; action?: string }> = {
    none: { title: depositsOn ? t("kycNoneTitle") : t("kycNoneTitleNoDeposit"), desc: t("kycNoneDesc"), action: t("kycNoneAction") },
    pending: { title: t("kycPendingTitle"), desc: t("kycPendingDesc") },
    rejected: { title: t("kycRejectedTitle"), desc: t("kycRejectedDesc"), action: t("kycRejectedAction") },
  };
  const kycStatus = kyc?.status ?? "none";
  // Identity verification is a real-account matter: a demo account never needs it.
  const kycCopy = activeType === "real" && kycStatus !== "approved" ? kycCopyByStatus[kycStatus] ?? kycCopyByStatus.none : null;

  return (
    <>
      <AppNav />
      <AppMain>
        <h1 className="sr-only">{tNav("navHome")}</h1>

        {error && <FlashMessage tone="error">{error}</FlashMessage>}

        {/* Portfolio summary: value, the last 24 hours, open trades, then how it is split, and the two
            next steps (deposit, find a trader). The full wallet with its chart is one tap away. */}
        <section className="flex flex-col gap-5 rounded-[20px] border border-border bg-surface p-5 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-muted">
              <span>{t("portfolioValue")}</span>
              {activeType === "demo" && (
                <span className="shrink-0 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-xs font-bold text-warning">
                  {t("accountDemo")}
                </span>
              )}
            </span>
            <Link href="/portfolio" aria-label={tNav("navPortfolio")} className="tap-44 shrink-0 rounded-full p-1 text-muted transition hover:text-foreground">
              <ChevronRight className="h-5 w-5 rtl:rotate-180" aria-hidden="true" />
            </Link>
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-4xl font-bold tabular-nums">
              <bdi dir="ltr">{money(walletValue)}</bdi>
            </p>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span>
                <span className="text-muted">{t("result24h")} </span>
                <bdi dir="ltr" className={`font-bold ${result24h > 0 ? "text-success" : result24h < 0 ? "text-danger" : "text-foreground"}`}>
                  {money(result24h, { signed: result24h !== 0 })}
                </bdi>
              </span>
              <span className="text-muted" aria-hidden="true">·</span>
              <Link href="/trades" className="text-muted hover:text-foreground">
                {t("openTradesCount", { count: openCount })}
              </Link>
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-2 rounded-2xl bg-background/60 p-3 text-center">
            <div>
              <dd className={`text-base font-bold ${unrealized > 0 ? "text-success" : unrealized < 0 ? "text-danger" : ""}`}>
                <bdi dir="ltr">{money(unrealized, { signed: unrealized !== 0 })}</bdi>
              </dd>
              <dt className="mt-0.5 text-xs text-muted">{t("unrealizedPnl")}</dt>
            </div>
            <div className="border-x border-border">
              <dd className="text-base font-bold">
                <bdi dir="ltr">{money(availableCash)}</bdi>
              </dd>
              <dt className="mt-0.5 text-xs text-muted">{t("allocationAvailableCash")}</dt>
            </div>
            <div>
              <dd className="text-base font-bold">
                <bdi dir="ltr">{money(investedInCopies)}</bdi>
              </dd>
              <dt className="mt-0.5 text-xs text-muted">{t("investedInCopies")}</dt>
            </div>
          </dl>
        </section>

        {kycCopy && (
          <div className="flex flex-col gap-4 rounded-[20px] border border-warning/30 bg-warning/10 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">{kycCopy.title}</p>
              <p className="mt-0.5 text-xs text-muted">{kycCopy.desc}</p>
            </div>
            {kycCopy.action && (
              <div className="flex shrink-0 gap-2">
                <Link
                  href="/kyc"
                  className="rounded-lg bg-warning px-4 py-2 text-center text-sm font-bold text-background transition hover:brightness-110"
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

        {(() => {
          const startHere = (
            <OnboardingStepsCard
              profileComplete={!!profile?.country}
              kycDone={kycStatus === "approved" || kycStatus === "pending"}
              firstCopyDone={(everCopied ?? 0) > 0 || copies.length > 0}
              notificationsReady={(prefsCount ?? 0) > 0}
            />
          );
          const performance = (
            <CopiesPerformance
              rows={copies.map((c) => {
                const row = byProvider.find((r) => r.provider_id === c.providerId);
                return {
                  providerId: c.providerId,
                  name: c.name,
                  avatarUrl: c.avatarUrl,
                  rating: c.rating,
                  invested: c.allocated,
                  result: c.total,
                  openCount: Number(row?.open_count ?? 0),
                };
              })}
            />
          );
          const watchlist = (
            <Suspense fallback={null}>
              <HomeWatchlist userId={user.id} />
            </Suspense>
          );
          const moves = (
            <Suspense fallback={null}>
              <TopMovers />
            </Suspense>
          );
          const news = (
            <Suspense fallback={null}>
              <HomeNews symbols={(watchRows ?? []).map((w) => String(w.symbol))} />
            </Suspense>
          );
          const traders = (
            <Suspense fallback={<SectionSkeleton />}>
              <TopTradersWeek excludeProviderIds={providerIds} />
            </Suspense>
          );
          // Active customer (eToro / Bybit order): how their copies are doing, what they follow, the
          // market, what happened, then other traders and learning. New customer (Bybit Lite /
          // Bitget new-user steps): the first steps, traders to start with, the market, learning.
          // Decided by the active copies themselves, so a slow totals call never shows the new-customer page.
          return (subscriptions ?? []).length > 0 ? (
            <>
              <QuickActions />
              {performance}
              {watchlist}
              {moves}
              {news}
              <RecentActivityTimeline events={activityEvents} />
              {traders}
              <LearnCards />
              <WhatsNew />
            </>
          ) : (
            <>
              <QuickActions />
              {startHere}
              {traders}
              {moves}
              {watchlist}
              {news}
              <RecentActivityTimeline events={activityEvents} />
              <LearnCards />
              <WhatsNew />
            </>
          );
        })()}

        <RiskFooter demo={activeType === "demo"} />
      </AppMain>
    </>
  );
}
