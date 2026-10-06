import { nowMs } from "@/lib/now";
import { getMoney } from "@/lib/money-server";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnProviderId, currentTier, nextTier } from "@/lib/lead-trader";
import { fetchProviderStats, computeStats } from "@/lib/provider-stats";
import { computeReliabilityTimeline, computeActiveTradingDays } from "@/lib/reliability";
import { getGaugeTier } from "@/components/CircularGauge";
import { ExnessReliabilitySection } from "@/components/ExnessReliabilitySection";
import { MonthlyReturnsCalendar } from "@/components/MonthlyReturnsCalendar";
import type { DailySeries } from "@/components/TraderEquityChart";
import { fetchLeadOverview } from "@/lib/lead-dashboard";
import type { Locale } from "@/i18n/locales";

type SignalRow = {
  id: string;
  symbol: string;
  side: string;
  entry_price: number;
  exit_price: number | null;
  status: string;
  opened_at: string;
  closed_at: string | null;
  close_trigger: string | null;
};


function StatCard({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`num text-lg font-semibold ${tone === "up" ? "text-success" : tone === "down" ? "text-danger" : ""}`}>{value}</p>
    </div>
  );
}

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("leadCenterTitle"), description: t("leadCenterDesc") };
}

export default async function LeadOverviewPage() {
  const t = await getTranslations("LeadTrader.overview");
  const money = await getMoney();
  const C = { compact: true } as const;
  const tp = await getTranslations("TraderProfile");
  const locale = (await getLocale()) as Locale;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Flead");

  const providerId = await getOwnProviderId(supabase, user.id);
  if (!providerId) redirect("/become-lead-trader");

  const [{ data: provider }, { data: profile }, { data: allSignals }, { data: subs }, periodStats, overview, { data: ltProfile }, { data: dailyRaw }] = await Promise.all([
    supabase.from("providers").select("display_name, profit_share_pct, min_copy_amount, trading_status").eq("id", providerId).single(),
    supabase.from("profiles").select("balance, is_suspended").eq("id", user.id).single(),
    supabase
      .from("signals")
      .select("id, symbol, side, entry_price, exit_price, status, opened_at, closed_at, close_trigger")
      .eq("provider_id", providerId)
      .eq("created_by_admin", false)
      .order("opened_at", { ascending: false }),
    supabase.from("subscriptions").select("id, allocated_amount, is_active, copy_started_at").eq("provider_id", providerId),
    Promise.all([7, 30, 90, 180].map((d) => fetchProviderStats(supabase, [providerId], d))),
    fetchLeadOverview(supabase),
    supabase.from("lead_trader_profiles").select("accepting_followers").eq("provider_id", providerId).maybeSingle(),
    supabase.rpc("provider_daily_series", { p_provider_id: providerId }),
  ]);
  const daily = (dailyRaw ?? null) as DailySeries | null;
  const accountStatus = profile?.is_suspended ? "suspended" : provider?.trading_status === "stopped" ? "stopped" : ltProfile?.accepting_followers === false ? "closed" : "active";

  const signals = (allSignals ?? []) as SignalRow[];
  const activeSubs = (subs ?? []).filter((s) => s.is_active);
  const subIds = (subs ?? []).map((s) => s.id);
  const aum = activeSubs.reduce((sum, s) => sum + Number(s.allocated_amount), 0);
  const followerCount = activeSubs.length;

  const { data: positions } = subIds.length
    ? await supabase.from("simulated_positions").select("subscription_id, status, pnl, entry_price, size, closed_at, signals(symbol, side)").in("subscription_id", subIds)
    : { data: [] as { subscription_id: string; status: string; pnl: number | null; entry_price: number; size: number; closed_at: string | null; signals: { symbol: string; side: string } | { symbol: string; side: string }[] | null }[] };

  const closedPositions = (positions ?? []).filter((p) => p.status === "closed");
  const openPositions = (positions ?? []).filter((p) => p.status === "open");
  const realizedFollowerProfit = closedPositions.reduce((sum, p) => sum + (p.pnl ?? 0), 0);

  const openSymbols = Array.from(
    new Set(openPositions.map((p) => (Array.isArray(p.signals) ? p.signals[0] : p.signals)?.symbol).filter((s): s is string => !!s)),
  );
  const { data: livePrices } = openSymbols.length
    ? await supabase.from("market_prices").select("symbol, price").in("symbol", openSymbols)
    : { data: [] as { symbol: string; price: number }[] };
  const priceBySymbol = new Map((livePrices ?? []).map((p) => [p.symbol, Number(p.price)]));
  const unrealizedFollowerProfit = openPositions.reduce((sum, p) => {
    const sig = Array.isArray(p.signals) ? p.signals[0] : p.signals;
    const current = sig ? priceBySymbol.get(sig.symbol) : undefined;
    if (current == null || !sig) return sum;
    const pct = ((current - p.entry_price) / p.entry_price) * (sig.side === "sell" ? -1 : 1);
    return sum + pct * Number(p.size);
  }, 0);

  const weekAgo = nowMs() - 7 * 86400000;
  const weekProfit = closedPositions
    .filter((p) => p.closed_at && new Date(p.closed_at).getTime() >= weekAgo)
    .reduce((sum, p) => sum + (p.pnl ?? 0), 0);

  const sharePct = Number(provider?.profit_share_pct ?? 0);
  const shareRealized = Math.max(0, realizedFollowerProfit) * (sharePct / 100);
  const shareUnrealized = Math.max(0, unrealizedFollowerProfit) * (sharePct / 100);
  const shareWeek = Math.max(0, weekProfit) * (sharePct / 100);

  const stats = computeStats(
    signals
      .filter((s) => s.status === "closed" && s.exit_price != null && s.closed_at)
      .map((s) => ({ provider_id: providerId, side: s.side, entry_price: s.entry_price, exit_price: s.exit_price!, opened_at: s.opened_at, closed_at: s.closed_at! })),
  );
  const activeDays = computeActiveTradingDays(signals);
  const tier = currentTier({ activeDays, aum, followerProfit: realizedFollowerProfit, maxDrawdownPct: stats.maxDrawdown });
  const next = nextTier(tier);

  const [d7, d30, d90, d180] = periodStats;
  const periodRows = [
    { label: t("period7"), stats: d7.get(providerId) },
    { label: t("period30"), stats: d30.get(providerId) },
    { label: t("period90"), stats: d90.get(providerId) },
    { label: t("period180"), stats: d180.get(providerId) },
  ];

  const reliabilityTimeline = computeReliabilityTimeline(signals);
  const latest = reliabilityTimeline[reliabilityTimeline.length - 1];
  const reliabilityScore = latest?.reliability ?? 50;
  const safetyScore = latest?.safety ?? 50;
  const riskExposureScore = latest?.risk ?? (stats.maxDrawdown != null ? Math.min(100, Math.round(stats.maxDrawdown * 8)) : 20);
  const limitScore = latest?.limitScore ?? 0;
  const reliabilityStatus = tp(
    { low: "reliabilityStatusLow", medium: "reliabilityStatusMedium", high: "reliabilityStatusHigh" }[getGaugeTier(reliabilityScore, "reliability")],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-page-title">{t("title")}</h1>
          <p className="text-sm text-muted">{provider?.display_name}</p>
        </div>
        <span className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-sm font-semibold text-accent">{tierLabel(tier.key, t)}</span>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t("accountStatus")} value={t(`status_${accountStatus}`)} tone={accountStatus === "active" ? "up" : accountStatus === "closed" ? undefined : "down"} />
        <StatCard label={t("aum")} value={money(overview?.aum ?? aum, C)} />
        <StatCard label={t("copiersTotal")} value={String(overview?.followers_total ?? 0)} />
        <StatCard label={t("copiersActive")} value={String(overview?.followers_active ?? 0)} />
        <StatCard label={t("copiersNewMonth")} value={String(overview?.followers_new_month ?? 0)} />
        <StatCard label={t("copiersStopped")} value={String(overview?.followers_stopped ?? 0)} />
        <StatCard label={t("earningsMonth")} value={money(overview?.earnings_month ?? 0, C)} />
        <StatCard label={t("earningsTotal")} value={money(overview?.earnings_total ?? 0, C)} />
        <StatCard label={t("earningsPending")} value={money(overview?.earnings_pending ?? 0, C)} />
      </section>

      {next && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="mb-2 text-sm font-medium">{t("nextTier", { tier: tierLabel(next.key, t) })}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ProgressItem label={t("progressDays")} value={activeDays} target={next.minActiveDays} />
            <ProgressItem label={t("progressAum")} value={aum} target={next.minAum} money={money} />
            <ProgressItem label={t("progressFollowerProfit")} value={realizedFollowerProfit} target={next.minFollowerProfit} money={money} />
          </div>
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t("leaderBalance")} value={money(Number(profile?.balance ?? 0))} />
        <StatCard label={t("followers")} value={`${followerCount} / ${tier.maxFollowers}`} />
        <StatCard label={t("followerProfit")} value={money(realizedFollowerProfit, C)} tone={realizedFollowerProfit >= 0 ? "up" : "down"} />
        <StatCard label={t("shareRealized")} value={money(shareRealized, C)} />
        <StatCard label={t("shareUnrealized")} value={money(shareUnrealized, C)} />
        <StatCard label={t("shareWeek")} value={money(shareWeek, C)} />
        <StatCard label={t("sharePct")} value={`${sharePct}%`} />
      </section>
      <p className="-mt-4 text-xs text-muted">{t("shareEstimateNote")}</p>

      <section className="flex flex-col gap-3">
        <h2 className="text-section-title">{t("periodReturns")}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {periodRows.map((r) => (
            <div key={r.label} className="rounded-xl border border-border bg-surface p-4 text-center">
              <p
                className={`num text-lg font-semibold ${(r.stats?.totalReturn ?? 0) >= 0 ? "text-success" : "text-danger"}`}
              >
                {r.stats ? `${r.stats.totalReturn >= 0 ? "+" : ""}${r.stats.totalReturn}%` : "—"}
              </p>
              <p className="text-xs text-muted">{r.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={tp("statOverallWinRate")} value={stats.winRate != null ? `${stats.winRate}%` : "—"} />
        <StatCard label={tp("statMaxDrawdown")} value={stats.maxDrawdown != null ? `-${stats.maxDrawdown}%` : "—"} />
        <StatCard label={tp("statSharpe")} value={String(stats.sharpe ?? "—")} />
        <StatCard label={tp("statAvgDuration")} value={stats.avgDurationHours != null ? `${stats.avgDurationHours}h` : "—"} />
        <StatCard label={t("tradesCount")} value={String(stats.trades)} />
        <StatCard label={t("activeDays")} value={String(activeDays)} />
      </section>

      <div className="border-t border-border pt-4">
        <ExnessReliabilitySection
          reliabilityScore={reliabilityScore}
          reliabilityStatus={reliabilityStatus}
          safetyScore={safetyScore}
          riskExposureScore={riskExposureScore}
          limitScore={limitScore}
          activeTradingDays={activeDays}
          daily={daily}
        />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-section-title">{tp("monthlyReturnsTitle")}</h2>
        <MonthlyReturnsCalendar daily={daily} locale={locale} />
      </section>
    </div>
  );
}

function tierLabel(key: string, t: Awaited<ReturnType<typeof getTranslations>>) {
  return t(`tier_${key}`);
}

function ProgressItem({ label, value, target, money }: { label: string; value: number; target: number; money?: (n: number, opts?: { compact?: boolean }) => string }) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 100;
  const fmt = (n: number) => (money ? money(n, { compact: true }) : String(n));
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs text-muted">
        <span>{label}</span>
        <span className="num">
          {fmt(value)} / {fmt(target)}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-background">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
