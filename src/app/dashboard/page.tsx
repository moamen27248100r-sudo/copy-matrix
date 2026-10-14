import { getMoney } from "@/lib/money-server";
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
import { SuggestedTraders } from "@/components/SuggestedTraders";
import { RecentActivityTimeline, type ActivityEvent } from "@/components/RecentActivityTimeline";
import { TopMovers } from "@/components/TopMovers";
import { TraderAvatar } from "@/components/TraderAvatar";
import { RiskFooter } from "@/components/RiskFooter";
import { Skeleton } from "@/components/ui/Skeleton";

function SectionSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
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
  };
  type Summary = { open: { count: number; unrealized: number }; by_provider: ProviderResult[] };
  const summary = (summaryRaw ?? null) as Summary | null;
  const byProvider = summary?.by_provider ?? [];
  const unrealized = Number(summary?.open?.unrealized ?? 0);

  const activeType: "real" | "demo" = profile?.account_type === "real" ? "real" : "demo";
  const providerIds = (subscriptions ?? []).map((s) => s.provider_id);
  const walletValue = Number(profile?.balance ?? 0) + unrealized;

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
  const topCopies = copies.slice(0, 3);
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
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6 pb-[calc(var(--bottom-nav-h)+1.5rem)] lg:ms-[var(--sidebar-w)] lg:me-0 lg:pb-6">
        <h1 className="sr-only">{tNav("navHome")}</h1>

        {error && <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        {/* One quiet line: the wallet value, a link to the wallet. */}
        <Link
          href="/portfolio"
          className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-2xl border border-border bg-surface px-4 py-3 transition hover:border-accent/40"
        >
          <span className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-muted">
            <span>{t("portfolioValue")}</span>
            {activeType === "demo" && (
              <span className="shrink-0 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
                {t("accountDemo")}
              </span>
            )}
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            <span dir="ltr" className="text-lg font-bold tabular-nums">
              {money(walletValue)}
            </span>
            <ChevronRight className="h-4 w-4 text-muted rtl:rotate-180" aria-hidden="true" />
          </span>
        </Link>

        {kycCopy && (
          <div className="flex flex-col gap-4 rounded-2xl border border-warning/30 bg-warning/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">{kycCopy.title}</p>
              <p className="mt-0.5 text-xs text-muted">{kycCopy.desc}</p>
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

        <OnboardingStepsCard
          profileComplete={!!profile?.country}
          firstCopyDone={copies.length > 0}
          protectionReady={activeType === "demo" || kycStatus === "approved"}
          notificationsReady={(prefsCount ?? 0) > 0}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          {topCopies.length > 0 && (
            <section className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-base font-semibold">{t("traderYouCopy")}</h2>
                <Link href="/copies" className="text-sm text-accent hover:underline">
                  {tNav("viewAll")}
                </Link>
              </div>
              <div className="flex flex-col gap-2">
                {topCopies.map((c) => (
                  <Link
                    key={c.subscriptionId}
                    href="/copies"
                    className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 transition hover:border-accent/40"
                  >
                    <TraderAvatar providerId={c.providerId} name={c.name} avatarUrl={c.avatarUrl} ratingScore={c.rating} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{c.name}</span>
                      <span className="block text-xs text-muted" dir="ltr">
                        {money(c.allocated)}
                      </span>
                    </span>
                    <span dir="ltr" className={`shrink-0 text-sm font-semibold tabular-nums ${c.total >= 0 ? "text-success" : "text-danger"}`}>
                      {money(c.total, { signed: true })}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <RecentActivityTimeline events={activityEvents} />
        </div>

        <Suspense fallback={<SectionSkeleton />}>
          <SuggestedTraders excludeProviderIds={providerIds} />
        </Suspense>

        <Suspense fallback={null}>
          <TopMovers />
        </Suspense>

        <RiskFooter demo={activeType === "demo"} />
      </main>
    </>
  );
}
