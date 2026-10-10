import { nowMs } from "@/lib/now";
import { getMoney } from "@/lib/money-server";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnProviderId, currentTier, nextTier } from "@/lib/lead-trader";
import { leaderScores } from "@/lib/leader-scores";
import { getGaugeTier } from "@/components/CircularGauge";
import { ExnessReliabilitySection } from "@/components/ExnessReliabilitySection";
import { MonthlyReturnsCalendar } from "@/components/MonthlyReturnsCalendar";
import type { DailySeries } from "@/components/TraderEquityChart";
import { fetchLeadOverview } from "@/lib/lead-dashboard";
import type { Locale } from "@/i18n/locales";

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

  // Every performance number comes from provider_cards (provider_stats, built
  // from the trades) -- the same row the public profile and discover read.
  const [{ data: provider }, { data: profile }, { data: card }, { data: subs }, overview, { data: ltProfile }, { data: dailyRaw }] = await Promise.all([
    supabase.from("providers").select("display_name, profit_share_pct, min_copy_amount, trading_status").eq("id", providerId).single(),
    supabase.from("profiles").select("balance, is_suspended").eq("id", user.id).single(),
    supabase.from("provider_cards").select("*").eq("provider_id", providerId).maybeSingle(),
    supabase.from("subscriptions").select("id, allocated_amount, is_active, copy_started_at").eq("provider_id", providerId),
    fetchLeadOverview(supabase),
    supabase.from("lead_trader_profiles").select("accepting_followers").eq("provider_id", providerId).maybeSingle(),
    supabase.rpc("provider_daily_series", { p_provider_id: providerId }),
  ]);
  const daily = (dailyRaw ?? null) as DailySeries | null;
  const accountStatus = profile?.is_suspended ? "suspended" : provider?.trading_status === "stopped" ? "stopped" : ltProfile?.accepting_followers === false ? "closed" : "active";

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

  const num = (v: unknown) => (v == null ? null : Number(v));
  const closedTrades = Number(card?.closed_signals ?? 0);
  const scores = leaderScores(card ?? {});
  const activeDays = scores.activeDays;
  const maxDrawdown = closedTrades > 0 ? num(card?.mdd_all) : null;
  const tier = currentTier({ activeDays, aum, followerProfit: realizedFollowerProfit, maxDrawdownPct: maxDrawdown });
  const next = nextTier(tier);

  const periodRows = (["7d", "30d", "90d", "180d"] as const).map((p, i) => ({
    label: t(["period7", "period30", "period90", "period180"][i]),
    roi: closedTrades > 0 ? num(card?.[`roi_${p}`]) : null,
  }));

  const reliabilityStatus =
    scores.reliability == null
      ? tp("reliabilityStatusNone")
      : tp({ low: "reliabilityStatusLow", medium: "reliabilityStatusMedium", high: "reliabilityStatusHigh" }[getGaugeTier(scores.reliability, "reliability")]);

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
              <p className={`num text-lg font-semibold ${(r.roi ?? 0) >= 0 ? "text-success" : "text-danger"}`}>
                {r.roi != null ? `${r.roi > 0 ? "+" : ""}${r.roi.toFixed(2)}%` : "—"}
              </p>
              <p className="text-xs text-muted">{r.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={tp("statOverallWinRate")} value={card?.win_rate_pct != null ? `${card.win_rate_pct}%` : "—"} />
        <StatCard label={tp("statMaxDrawdown")} value={maxDrawdown != null ? `-${maxDrawdown}%` : "—"} />
        <StatCard label={tp("statSharpe")} value={card?.sharpe_all != null ? String(card.sharpe_all) : "—"} />
        <StatCard
          label={tp("statAvgDuration")}
          value={card?.avg_hold_hours != null ? tp("hoursShort", { hours: Math.round(Number(card.avg_hold_hours) * 10) / 10 }) : "—"}
        />
        <StatCard label={t("tradesCount")} value={String(closedTrades)} />
        <StatCard label={t("activeDays")} value={String(activeDays)} />
      </section>

      <div className="border-t border-border pt-4">
        <ExnessReliabilitySection
          reliabilityScore={scores.reliability}
          reliabilityStatus={reliabilityStatus}
          safetyScore={scores.safety}
          riskExposureScore={scores.risk}
          limitScore={scores.limit}
          activeTradingDays={activeDays}
          activity={scores.activity}
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
