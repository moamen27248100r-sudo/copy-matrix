import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/locale-format";
import type { Locale } from "@/i18n/locales";
import { unfollowProvider } from "@/app/discover/actions";
import { AppNav } from "@/components/AppNav";
import { PortfolioTabs } from "@/components/PortfolioTabs";
import { TradeHistory } from "@/components/TradeHistory";
import { PortfolioValueBreakdown } from "@/components/PortfolioValueBreakdown";
import { MyEquityChart } from "@/components/MyEquityChart";
import { AutoDismissMessage } from "@/components/AutoDismissMessage";
import { MyOpenPositions } from "@/components/MyOpenPositions";
import { PositionTabs } from "@/components/PositionTabs";
import { PendingOrdersEmpty } from "@/components/PendingOrdersEmpty";
import { TraderAvatar } from "@/components/TraderAvatar";

type PositionSignal = {
  symbol: string;
  side: string;
  provider_id: string;
  stop_loss: number | null;
  take_profit: number | null;
};
type Position = {
  id: string;
  entry_price: number;
  exit_price: number | null;
  size: number;
  status: string;
  pnl: number | null;
  opened_at: string;
  closed_at: string | null;
  signals: PositionSignal | PositionSignal[] | null;
};

function positionSignal(pos: Position): PositionSignal | null {
  return Array.isArray(pos.signals) ? pos.signals[0] ?? null : pos.signals;
}

function signedReturnPct(pos: Position) {
  const signal = positionSignal(pos);
  if (!signal || pos.exit_price == null) return 0;
  const raw = (pos.exit_price - pos.entry_price) / pos.entry_price;
  return (signal.side === "sell" ? -raw : raw) * 100;
}

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; tab?: string }>;
}) {
  const { error, success, tab } = await searchParams;
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("Portfolio");
  const td = await getTranslations("Dashboard");
  const TX_LABELS: Record<string, string> = {
    deposit: t("txDeposit"),
    withdrawal: t("txWithdrawal"),
    pnl: t("txPnl"),
  };
  const REQUEST_STATUS_LABELS: Record<string, string> = {
    pending: t("statusPending"),
    approved: t("statusApproved"),
    rejected: t("statusRejected"),
  };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: subscriptions } = await supabase
    .from("subscriptions")
    .select("provider_id, allocated_amount")
    .eq("follower_id", user.id)
    .eq("is_active", true);

  const providerIds = (subscriptions ?? []).map((s) => s.provider_id);
  const allocationByProvider = new Map((subscriptions ?? []).map((s) => [s.provider_id, s.allocated_amount]));

  const [
    { data: profile },
    { data: followedProviders },
    { data: positions },
    { data: transactions },
    { data: walletRequests },
  ] = await Promise.all([
      supabase.from("profiles").select("balance").eq("id", user.id).single(),
      providerIds.length > 0
        ? supabase.from("provider_cards").select("*").in("provider_id", providerIds)
        : Promise.resolve({ data: [] as never[] }),
      supabase
        .from("simulated_positions")
        .select(
          "id, entry_price, exit_price, size, status, pnl, opened_at, closed_at, signals(symbol, side, provider_id, stop_loss, take_profit)",
        )
        .eq("follower_id", user.id)
        .order("opened_at", { ascending: false }),
      supabase
        .from("wallet_transactions")
        .select("id, type, amount, balance_after, note, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("wallet_requests")
        .select("id, type, amount, status, requested_at")
        .eq("user_id", user.id)
        .order("requested_at", { ascending: false })
        .limit(20),
    ]);

  const pendingRequests = (walletRequests ?? []).filter((r) => r.status === "pending");

  const allPositions = (positions ?? []) as Position[];
  const closedPositions = allPositions.filter((p) => p.status === "closed");
  const openPositions = allPositions.filter((p) => p.status === "open");
  const totalRealizedPnl = closedPositions.reduce((sum, p) => sum + (p.pnl ?? 0), 0);

  const openSymbols = Array.from(
    new Set(openPositions.map((p) => positionSignal(p)?.symbol).filter((s): s is string => !!s)),
  );
  const { data: livePrices } =
    openSymbols.length > 0
      ? await supabase.from("market_prices").select("symbol, price").in("symbol", openSymbols)
      : { data: [] as { symbol: string; price: number }[] };
  const initialPrices: Record<string, number> = Object.fromEntries(
    (livePrices ?? []).map((p) => [p.symbol, Number(p.price)]),
  );

  const myOpenPositions = openPositions
    .map((pos) => {
      const signal = positionSignal(pos);
      if (!signal) return null;
      return {
        id: pos.id,
        symbol: signal.symbol,
        side: signal.side,
        entry_price: Number(pos.entry_price),
        size: Number(pos.size),
        take_profit: signal.take_profit,
        stop_loss: signal.stop_loss,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p != null);
  const totalUnrealizedPnl = myOpenPositions.reduce((sum, p) => {
    const current = initialPrices[p.symbol];
    if (current == null) return sum;
    const pct = ((current - p.entry_price) / p.entry_price) * (p.side === "sell" ? -1 : 1);
    return sum + pct * p.size;
  }, 0);
  const totalAllocated = Array.from(allocationByProvider.values()).reduce((sum, a) => sum + Number(a), 0);

  const myWins = closedPositions.filter((p) => (p.pnl ?? 0) >= 0).length;
  const myWinRatePct = closedPositions.length > 0 ? Math.round((myWins / closedPositions.length) * 100) : null;
  const myAvgReturnPct =
    closedPositions.length > 0
      ? closedPositions.reduce((sum, p) => sum + signedReturnPct(p), 0) / closedPositions.length
      : null;

  const historyProviderIds = Array.from(
    new Set(
      allPositions
        .map((p) => positionSignal(p)?.provider_id)
        .filter((id): id is string => !!id),
    ),
  );

  const { data: historyProviders } =
    historyProviderIds.length > 0
      ? await supabase.from("provider_cards").select("provider_id, display_name").in("provider_id", historyProviderIds)
      : { data: [] as { provider_id: string; display_name: string }[] };

  const providerNameById = new Map(
    (historyProviders ?? []).map((p) => [p.provider_id, p.display_name]),
  );

  const closedHistory = closedPositions.map((pos) => {
    const signal = positionSignal(pos);
    return {
      id: pos.id,
      symbol: signal?.symbol ?? "—",
      side: signal?.side ?? "buy",
      size: Number(pos.size),
      entry: Number(pos.entry_price),
      exit: pos.exit_price != null ? Number(pos.exit_price) : null,
      pnl: pos.pnl ?? 0,
      pct: signedReturnPct(pos),
      openedAt: pos.opened_at,
      closedAt: pos.closed_at,
      copyHref: signal?.provider_id ? `/trader/${signal.provider_id}#copy` : undefined,
      providerName: signal ? providerNameById.get(signal.provider_id) ?? "—" : "—",
      stopLoss: signal?.stop_loss ?? null,
      takeProfit: signal?.take_profit ?? null,
    };
  });

  const overview = (
    <div className="flex flex-col gap-6">
      <section id="wallet" className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 scroll-mt-20">
        <PortfolioValueBreakdown
          balance={Number(profile?.balance ?? 0)}
          totalAllocated={totalAllocated}
          totalUnrealizedPnl={totalUnrealizedPnl}
        />
        <div className="grid grid-cols-3 gap-3">
          <Link href="/portfolio/withdraw" className="flex flex-col items-center gap-2">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-background text-foreground transition group-hover:bg-accent/10">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12l7-7 7 7" />
                <path d="M12 5v14" />
              </svg>
            </span>
            <span className="text-sm text-foreground">{td("withdraw")}</span>
          </Link>
          <Link href="/portfolio/deposit" className="flex flex-col items-center gap-2">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-background text-foreground">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 5v14" />
                <path d="M5 12l7 7 7-7" />
              </svg>
            </span>
            <span className="text-sm text-foreground">{td("deposit")}</span>
          </Link>
          <Link href="/discover" className="flex flex-col items-center gap-2">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
              </svg>
            </span>
            <span className="text-sm text-foreground">{td("copy")}</span>
          </Link>
        </div>
        <p className="text-xs text-muted">{t("instantProcessingNote")}</p>

        {pendingRequests.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted">{t("pendingRequestsLabel")}</p>
            {pendingRequests.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded border border-border bg-background px-3 py-2 text-sm"
              >
                <span>{r.type === "deposit" ? td("deposit") : td("withdraw")} ${Number(r.amount).toLocaleString("en-US")}</span>
                <span className="text-xs text-muted">{REQUEST_STATUS_LABELS[r.status]}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">{t("cumulativePerformance")}</h2>
        <MyEquityChart positions={closedPositions.map((p) => ({ pnl: p.pnl, closed_at: p.closed_at }))} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">{t("myPerformance")}</h2>
        <div className="grid grid-cols-2 gap-3 text-center text-sm sm:grid-cols-4">
          <div className="rounded-lg border border-border bg-surface p-3">
            <p className={totalRealizedPnl >= 0 ? "text-lg font-semibold text-success" : "text-lg font-semibold text-danger"} dir="ltr">
              {totalRealizedPnl >= 0 ? "+" : ""}
              {totalRealizedPnl.toFixed(2)}
            </p>
            <p className="text-xs text-muted">{td("netRealizedProfit")}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3">
            <p className="text-lg font-semibold">{myWinRatePct != null ? `${myWinRatePct}%` : "—"}</p>
            <p className="text-xs text-muted">{t("myWinRate")}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3">
            <p
              className={
                myAvgReturnPct != null && myAvgReturnPct < 0
                  ? "text-lg font-semibold text-danger"
                  : "text-lg font-semibold text-success"
              }
              dir="ltr"
            >
              {myAvgReturnPct != null ? `${myAvgReturnPct > 0 ? "+" : ""}${myAvgReturnPct.toFixed(2)}%` : "—"}
            </p>
            <p className="text-xs text-muted">{t("avgTradeReturn")}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3">
            <p className="text-lg font-semibold">{closedPositions.length}</p>
            <p className="text-xs text-muted">{t("closedTradesCount")}</p>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">{td("traderYouCopy")}</h2>
        {(followedProviders ?? []).length === 0 ? (
          <p className="text-sm text-muted">
            {t.rich("notCopyingYet", {
              link: (chunks) => (
                <Link href="/discover" className="underline">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        ) : (
          followedProviders!.map((p) => (
            <div
              key={p.provider_id}
              className="flex items-center justify-between rounded-lg border border-border bg-surface p-3"
            >
              <Link href={`/trader/${p.provider_id}`} className="flex items-center gap-3">
                <TraderAvatar providerId={p.provider_id} name={p.display_name} avatarUrl={p.avatar_url} ratingScore={p.rating_score} size={40} />
                <div>
                  <p className="text-sm font-medium underline-offset-2 hover:underline">
                    {p.display_name}
                  </p>
                  <p className="text-xs text-muted">
                    {td("startedWith", { amount: Number(allocationByProvider.get(p.provider_id) ?? 0).toLocaleString("en-US") })}
                  </p>
                </div>
              </Link>
              <form action={unfollowProvider}>
                <input type="hidden" name="providerId" value={p.provider_id} />
                <input type="hidden" name="returnTo" value="/portfolio" />
                <button
                  type="submit"
                  className="rounded border border-border px-3 py-1 text-xs"
                >
                  {t("stopCopying")}
                </button>
              </form>
            </div>
          ))
        )}
      </section>
    </div>
  );

  const positionsPanel = (
    <PositionTabs
      openCount={myOpenPositions.length}
      closedCount={closedHistory.length}
      open={<MyOpenPositions positions={myOpenPositions} initialPrices={initialPrices} />}
      pending={<PendingOrdersEmpty />}
      closed={
        closedHistory.length === 0 ? (
          <p className="text-sm text-muted">{t("noClosedCopiedTrades")}</p>
        ) : (
          <TradeHistory trades={closedHistory} />
        )
      }
    />
  );

  const walletMovements = (transactions ?? []).filter((t) => t.type === "deposit" || t.type === "withdrawal");

  const activity = (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h2 className="font-medium">{t("walletMovements")}</h2>
        {walletMovements.length === 0 ? (
          <p className="text-sm text-muted">{t("noWalletMovements")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-border text-right text-xs text-muted">
                  <th className="py-2 pl-3">{t("date")}</th>
                  <th className="py-2 pl-3">{t("type")}</th>
                  <th className="py-2 pl-3">{t("amount")}</th>
                  <th className="py-2">{t("balanceAfter")}</th>
                </tr>
              </thead>
              <tbody>
                {walletMovements.map((t) => (
                  <tr key={t.id} className="border-b border-border/60">
                    <td className="py-2 pl-3 whitespace-nowrap text-xs text-muted">
                      {formatDate(t.created_at, locale, { timeZone: "UTC" })}
                    </td>
                    <td className="py-2 pl-3 whitespace-nowrap">{TX_LABELS[t.type] ?? t.type}</td>
                    <td className={Number(t.amount) >= 0 ? "py-2 pl-3 whitespace-nowrap text-success" : "py-2 pl-3 whitespace-nowrap text-danger"}>
                      {Number(t.amount) >= 0 ? "+" : ""}
                      {Number(t.amount).toFixed(2)}
                    </td>
                    <td className="py-2 whitespace-nowrap">${Number(t.balance_after).toLocaleString("en-US", { maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">{t("depositWithdrawRequests")}</h2>
        {(walletRequests ?? []).length === 0 ? (
          <p className="text-sm text-muted">{t("noRequests")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-border text-right text-xs text-muted">
                  <th className="py-2 pl-3">{t("date")}</th>
                  <th className="py-2 pl-3">{t("type")}</th>
                  <th className="py-2 pl-3">{t("amount")}</th>
                  <th className="py-2">{t("status")}</th>
                </tr>
              </thead>
              <tbody>
                {walletRequests!.map((r) => (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className="py-2 pl-3 whitespace-nowrap text-xs text-muted">
                      {formatDate(r.requested_at, locale, { timeZone: "UTC" })}
                    </td>
                    <td className="py-2 pl-3 whitespace-nowrap">{r.type === "deposit" ? td("deposit") : td("withdraw")}</td>
                    <td className="py-2 pl-3 whitespace-nowrap">${Number(r.amount).toLocaleString("en-US")}</td>
                    <td className="py-2 whitespace-nowrap">
                      <span
                        className={
                          r.status === "approved"
                            ? "text-success"
                            : r.status === "rejected"
                              ? "text-danger"
                              : "text-muted"
                        }
                      >
                        {REQUEST_STATUS_LABELS[r.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );

  return (
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>

        {error && (
          <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        {success && (
          <AutoDismissMessage
            className="rounded border border-success/30 bg-success/10 px-3 py-2 text-sm text-success"
            clearParams={["success"]}
          >
            {t("successMessage")}
          </AutoDismissMessage>
        )}

        <PortfolioTabs overview={overview} positions={positionsPanel} activity={activity} initialTab={tab} />
      </main>
    </>
  );
}
