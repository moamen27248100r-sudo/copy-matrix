import { getMoney } from "@/lib/money-server";
import { AppMain } from "@/components/AppMain";
import { EmptyState } from "@/components/ui/EmptyState";
import { SuggestedLeaders } from "@/components/SuggestedLeaders";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime } from "@/lib/locale-format";
import { getUserTimeZone } from "@/lib/timezone";
import type { Locale } from "@/i18n/locales";
import { AppNav } from "@/components/AppNav";
import { WalletCard } from "@/components/WalletCard";
import type { Benchmarks } from "@/components/MyEquityChart";
import { AutoDismissMessage } from "@/components/AutoDismissMessage";
import { AllocationCard } from "@/components/AllocationCard";
import { PortfolioRiskCard } from "@/components/PortfolioRiskCard";
import { WalletStatusBadge } from "@/components/wallet/WalletStatus";
import { RiskFooter } from "@/components/RiskFooter";
import { depositsEnabled } from "@/lib/deposits-enabled";
import { computeRisk, currentDrawdownPct, leaderRiskLevel } from "@/lib/portfolio-risk";
import { FlashMessage } from "@/components/ui/Toast";

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("portfolioTitle"), description: t("portfolioDesc") };
}

// The wallet is the one place for money: the balance card, the comparison with a reference market,
// the asset mix, the risk indicator, deposit / withdraw, the transaction log and the demo reset.
// (Open positions and the trade history live in "Trades"; the copies in "Copies".)
export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; tab?: string; demo?: string }>;
}) {
  const { error, tab, demo } = await searchParams;
  // The old "Positions" tab moved to Trades.
  if (tab === "positions") redirect("/trades");
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("Portfolio");
  const td = await getTranslations("Dashboard");
  const tc = await getTranslations("Copies");
  const tw = await getTranslations("Wallet");
  const money = await getMoney();
  const userTz = await getUserTimeZone();
  const TX_LABELS: Record<string, string> = {
    deposit: t("txDeposit"),
    withdrawal: t("txWithdrawal"),
    pnl: t("txPnl"),
    demo_reset: t("txDemoReset"),
    admin_adjustment: t("txAdjustment"),
    fee: t("txFee"),
    withdrawal_refund: t("txWithdrawalRefund"),
  };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=%2Fportfolio");
  }

  const { data: accountRow } = await supabase.from("profiles").select("account_type, balance").eq("id", user.id).single();
  const accountType: "demo" | "real" = accountRow?.account_type === "real" ? "real" : "demo";
  const isDemo = accountType === "demo";
  const balance = Number(accountRow?.balance ?? 0);

  const [
    { data: subscriptions },
    { data: transactions },
    { data: pendingDeposits },
    { data: openWithdrawals },
    { data: portfolioSummary },
    { data: dashSummary },
    { data: benchmarkBundle },
    depositsOn,
  ] = await Promise.all([
    supabase.from("subscriptions").select("provider_id, allocated_amount").eq("follower_id", user.id).eq("is_active", true),
    // Wallet history is per account: the demo and real ledgers never mix.
    supabase
      .from("wallet_transactions")
      .select("id, type, amount, balance_after, note, created_at")
      .eq("user_id", user.id)
      .eq("account_type", accountType)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("crypto_deposits")
      .select("id, network, amount, status, confirmations, required_confirmations, created_at")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("crypto_withdrawals")
      .select("id, network, amount, status, created_at")
      .eq("user_id", user.id)
      .in("status", ["processing", "sending"])
      .order("created_at", { ascending: false }),
    // Net invested funds, the monthly report and the closed-trade series (migration 0255).
    supabase.rpc("portfolio_summary", { p_tz: userTz }),
    // Per trader / per asset class breakdown and the open result (migration 0254).
    supabase.rpc("dashboard_summary", { p_tz: userTz }),
    supabase.rpc("benchmark_bundle"),
    depositsEnabled(supabase),
  ]);

  type PortfolioSummary = {
    net_invested: number;
    avg_return_pct: number | null;
    closed: { closed_count: number; wins: number; realized: number };
    series: { t: number; v: number }[];
    monthly: { key: string; trades: number; wins: number; pnl: number; deposits: number; withdrawals: number }[];
  };
  type DashSummary = {
    open: { count: number; unrealized: number; invested: number };
    by_provider: { provider_id: string; display_name: string | null; risk_level: string | null; allocated: number }[];
    by_class: { class: string; value: number }[];
    series: { t: number; v: number }[];
  };
  const summary = (portfolioSummary ?? null) as PortfolioSummary | null;
  const dash = (dashSummary ?? null) as DashSummary | null;
  const netInvested = summary ? Number(summary.net_invested) : null;
  const unrealized = Number(dash?.open?.unrealized ?? 0);
  const totalAllocated = (subscriptions ?? []).reduce((sum, s) => sum + Number(s.allocated_amount), 0);
  const realized = summary ? Number(summary.closed.realized) : 0;
  const closedCount = summary ? Number(summary.closed.closed_count) : 0;
  const wins = summary ? Number(summary.closed.wins) : 0;
  const winRatePct = closedCount > 0 ? Math.round((wins / closedCount) * 100) : null;
  const avgReturnPct = summary?.avg_return_pct == null ? null : Number(summary.avg_return_pct);

  // Real-wallet movements still in progress: deposits awaiting confirmations, withdrawals not yet sent.
  const pendingRequests = isDemo
    ? []
    : [
        ...(pendingDeposits ?? []).map((d) => ({ ...d, kind: "deposit" as const })),
        ...(openWithdrawals ?? []).map((w) => ({ ...w, kind: "withdrawal" as const, confirmations: 0, required_confirmations: 0 })),
      ].sort((a, b) => b.created_at.localeCompare(a.created_at));

  // Allocation views and the risk indicator (formula and weights in lib/portfolio-risk.ts).
  const byProvider = dash?.by_provider ?? [];
  const assetClassLabel: Record<string, string> = {
    metal: td("assetClassMetal"),
    forex: td("assetClassForex"),
    crypto: td("assetClassCrypto"),
    other: td("assetClassOther"),
  };
  const allocationByTrader = [
    ...byProvider.map((p) => ({ label: p.display_name ?? "", value: Number(p.allocated) })),
    { label: td("allocationAvailableCash"), value: Math.max(0, balance - totalAllocated) },
  ];
  const allocationByAsset = [
    ...(dash?.by_class ?? []).map((c) => ({ label: assetClassLabel[c.class] ?? assetClassLabel.other, value: Math.max(0, Number(c.value)) })),
    { label: td("allocationNotInvested"), value: Math.max(0, balance - Number(dash?.open?.invested ?? 0)) },
  ];
  const drawdownPct = currentDrawdownPct(dash?.series ?? [], netInvested ?? 0, realized, unrealized);
  const risk = computeRisk({
    reservedRatio: balance > 0 ? totalAllocated / balance : 0,
    drawdownPct,
    leaders: byProvider.flatMap((p) => {
      const level = leaderRiskLevel(p.risk_level);
      return level ? [{ level, amount: Number(p.allocated) }] : [];
    }),
  });

  // Last 6 months (UTC), newest first -- computed by the database from every closed trade and every
  // wallet deposit / withdrawal of this account (portfolio_summary).
  const monthlyReport = (summary?.monthly ?? []).map((m) => ({
    key: m.key,
    trades: Number(m.trades),
    wins: Number(m.wins),
    pnl: Number(m.pnl),
    deposits: Number(m.deposits),
    withdrawals: Number(m.withdrawals),
  }));

  const walletMovements = (transactions ?? []).filter((x) => x.type === "deposit" || x.type === "withdrawal" || x.type === "demo_reset").slice(0, 5);

  return (
    <>
      <AppNav />
      <AppMain>
        <h1 className="text-page-title">{t("title")}</h1>

        {error && <FlashMessage tone="error">{error}</FlashMessage>}
        {demo && (
          <AutoDismissMessage className="rounded border border-success/30 bg-success/10 px-3 py-2 text-sm text-success" clearParams={["demo"]}>
            {demo === "deposit" ? t("demoDepositDone") : demo === "withdraw" ? t("demoWithdrawDone") : t("demoResetDone")}
          </AutoDismissMessage>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <WalletCard
              isDemo={isDemo}
              depositsOn={depositsOn}
              totalValue={balance + unrealized}
              cash={Math.max(0, balance - totalAllocated)}
              invested={totalAllocated}
              unrealized={unrealized}
              series={(summary?.series ?? []).map((p) => ({ pnl: p.v, closed_at: new Date(p.t).toISOString() }))}
              netInvested={netInvested}
              benchmarks={(benchmarkBundle ?? null) as Benchmarks | null}
            />

            {pendingRequests.length > 0 && (
              <section className="flex flex-col gap-2 rounded-[20px] border border-border bg-surface p-5">
                <p className="text-xs font-medium text-muted">{t("pendingRequestsLabel")}</p>
                {pendingRequests.map((r) => (
                  <Link
                    key={r.id}
                    href={r.kind === "deposit" ? "/portfolio/history" : "/portfolio/history?tab=withdrawals"}
                    className="flex items-center justify-between gap-2 rounded border border-border bg-background px-3 py-2 text-sm transition hover:border-accent/40"
                  >
                    <span>
                      {r.kind === "deposit" ? td("deposit") : td("withdraw")} {r.amount != null ? money(Number(r.amount)) : ""}{" "}
                      <span className="text-xs text-muted">· {r.network}</span>
                    </span>
                    <WalletStatusBadge status={r.status} confirmations={r.confirmations} required={r.required_confirmations} />
                  </Link>
                ))}
              </section>
            )}
            <p className="text-xs text-muted">{isDemo ? t("demoWalletNote") : t("reviewProcessingNote")}</p>
          </div>

          <div className="flex flex-col gap-4">
            <section className="flex flex-col gap-3">
              <h2 className="text-section-title">{td("portfolioAllocationTitle")}</h2>
              <div className="rounded-[20px] border border-border bg-surface p-5">
                <AllocationCard
                  byTrader={allocationByTrader}
                  byAsset={allocationByAsset}
                  totalLabel={td("portfolioValue")}
                  totalValue={balance + unrealized}
                />
              </div>
            </section>
            <PortfolioRiskCard
              risk={risk}
              reservedPct={balance > 0 ? Math.min(100, (totalAllocated / balance) * 100) : 0}
              drawdownPct={drawdownPct}
              hasCopies={byProvider.length > 0}
            />
          </div>
        </div>

        {closedCount === 0 ? (
          <>
            <EmptyState title={t("performanceEmptyTitle")} message={t("performanceEmptyBody")} actionHref="/discover" actionLabel={tc("discover")} />
            <SuggestedLeaders excludeProviderIds={byProvider.map((p) => p.provider_id)} />
          </>
        ) : (
          <>
          <section className="flex flex-col gap-3">
            <h2 className="text-section-title">{t("myPerformance")}</h2>
            <div className="grid grid-cols-2 gap-3 text-center text-sm sm:grid-cols-4">
              <div className="rounded-lg border border-border bg-surface p-3">
                <p className={realized >= 0 ? "text-lg font-bold text-success" : "text-lg font-bold text-danger"} dir="ltr">
                  {money(realized, { signed: true })}
                </p>
                <p className="text-xs text-muted">{td("netRealizedProfit")}</p>
              </div>
              <div className="rounded-lg border border-border bg-surface p-3">
                <p className="text-lg font-bold">{winRatePct != null ? `${winRatePct}%` : "—"}</p>
                <p className="text-xs text-muted">{t("myWinRate")}</p>
              </div>
              <div className="rounded-lg border border-border bg-surface p-3">
                <p
                  className={avgReturnPct != null && avgReturnPct < 0 ? "text-lg font-bold text-danger" : "text-lg font-bold text-success"}
                  dir="ltr"
                >
                  {avgReturnPct != null ? `${avgReturnPct > 0 ? "+" : ""}${avgReturnPct.toFixed(2)}%` : "—"}
                </p>
                <p className="text-xs text-muted">{t("avgTradeReturn")}</p>
              </div>
              <div className="rounded-lg border border-border bg-surface p-3">
                <p className="text-lg font-bold">{closedCount}</p>
                <p className="text-xs text-muted">{t("closedTradesCount")}</p>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-section-title">{t("monthlyReportTitle")}</h2>
            {monthlyReport.length === 0 ? (
              <p className="text-sm text-muted">{t("monthlyReportEmpty")}</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border bg-surface">
                <table className="w-full min-w-[420px] text-sm tabular-nums">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted">
                      <th className="px-3 py-2 text-start font-normal">{t("date")}</th>
                      <th className="px-3 py-2 text-start font-normal">{t("closedTradesCount")}</th>
                      <th className="px-3 py-2 text-start font-normal">{t("myWinRate")}</th>
                      <th className="px-3 py-2 text-start font-normal">{t("txPnl")}</th>
                      <th className="px-3 py-2 text-start font-normal">
                        {t("txDeposit")} / {t("txWithdrawal")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyReport.map((m) => (
                      <tr key={m.key} className="border-b border-border/60 last:border-b-0">
                        <td className="px-3 py-2 whitespace-nowrap">
                          {formatDate(`${m.key}-01T00:00:00Z`, locale, { month: "long", year: "numeric", timeZone: "UTC" })}
                        </td>
                        <td className="px-3 py-2">{m.trades}</td>
                        <td className="px-3 py-2">{m.trades ? `${Math.round((m.wins / m.trades) * 100)}%` : "—"}</td>
                        <td className={`px-3 py-2 ${m.pnl >= 0 ? "text-success" : "text-danger"}`} dir="ltr">
                          {money(m.pnl, { signed: true })}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap" dir="ltr">
                          {money(m.deposits, { signed: true })} / {money(-m.withdrawals)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          </>
        )}

        <section className="flex flex-col gap-2">
          <h2 className="text-section-title">{t("transactionsTitle")}</h2>
          {walletMovements.length === 0 ? (
            <p className="text-sm text-muted">{t("noWalletMovements")}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-surface">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted">
                    <th className="px-3 py-2 text-start font-normal">{t("date")}</th>
                    <th className="px-3 py-2 text-start font-normal">{t("type")}</th>
                    <th className="px-3 py-2 text-start font-normal">{t("amount")}</th>
                    <th className="px-3 py-2 text-start font-normal">{t("balanceAfter")}</th>
                  </tr>
                </thead>
                <tbody>
                  {walletMovements.map((x) => (
                    <tr key={x.id} className="border-b border-border/60 last:border-b-0">
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">
                        {formatDateTime(x.created_at, locale, { dateStyle: "medium", timeStyle: "short", timeZone: userTz })}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">{TX_LABELS[x.type] ?? x.type}</td>
                      <td className={Number(x.amount) >= 0 ? "whitespace-nowrap px-3 py-2 text-success" : "whitespace-nowrap px-3 py-2 text-danger"} dir="ltr">
                        {money(Number(x.amount), { signed: true })}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2" dir="ltr">
                        {money(Number(x.balance_after))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Link href="/portfolio/history" className="w-fit text-sm font-medium text-accent hover:underline">
            {tw("viewAllHistory")}
          </Link>
        </section>

        <RiskFooter demo={isDemo} />
      </AppMain>
    </>
  );
}
