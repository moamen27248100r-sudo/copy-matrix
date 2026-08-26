import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { unfollowProvider } from "@/app/discover/actions";
import { requestDeposit, requestWithdrawal } from "@/app/portfolio/actions";
import { AppNav } from "@/components/AppNav";
import { BackButton } from "@/components/BackButton";
import { PortfolioTabs } from "@/components/PortfolioTabs";
import { TradeHistory } from "@/components/TradeHistory";

const TX_LABELS: Record<string, string> = {
  deposit: "إيداع",
  withdrawal: "سحب",
  pnl: "نتيجة صفقة",
};

const REQUEST_STATUS_LABELS: Record<string, string> = {
  pending: "قيد المراجعة",
  approved: "مقبول",
  rejected: "مرفوض",
};

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
  const totalRealizedPnl = closedPositions.reduce((sum, p) => sum + (p.pnl ?? 0), 0);

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
        <div>
          <p className="text-xs text-muted">الرصيد المتاح</p>
          <p className="text-3xl font-semibold">
            ${profile?.balance != null ? Number(profile.balance).toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—"}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <form action={requestDeposit} className="flex items-center gap-2">
            <input
              name="amount"
              type="number"
              step="any"
              min="1"
              placeholder="مبلغ الإيداع"
              required
              className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm"
            />
            <button type="submit" className="rounded bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:bg-accent-hover">
              طلب إيداع
            </button>
          </form>
          <form action={requestWithdrawal} className="flex items-center gap-2">
            <input
              name="amount"
              type="number"
              step="any"
              min="1"
              placeholder="مبلغ السحب"
              required
              className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm"
            />
            <button type="submit" className="rounded border border-border bg-background px-4 py-2 text-sm text-foreground">
              طلب سحب
            </button>
          </form>
        </div>
        <p className="text-xs text-muted">
          طلبات الإيداع والسحب تحتاج مراجعة وموافقة من فريق الإدارة قبل ما تنعكس على رصيدك.
        </p>

        {pendingRequests.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted">طلبات قيد المراجعة</p>
            {pendingRequests.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded border border-border bg-background px-3 py-2 text-sm"
              >
                <span>{r.type === "deposit" ? "إيداع" : "سحب"} ${Number(r.amount).toLocaleString("en-US")}</span>
                <span className="text-xs text-muted">{REQUEST_STATUS_LABELS[r.status]}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">أداء نسخي</h2>
        <div className="grid grid-cols-2 gap-3 text-center text-sm sm:grid-cols-4">
          <div className="rounded-lg border border-border bg-surface p-3">
            <p className={totalRealizedPnl >= 0 ? "text-lg font-semibold text-success" : "text-lg font-semibold text-danger"} dir="ltr">
              {totalRealizedPnl >= 0 ? "+" : ""}
              {totalRealizedPnl.toFixed(2)}
            </p>
            <p className="text-xs text-muted">صافي الأرباح المحققة</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3">
            <p className="text-lg font-semibold">{myWinRatePct != null ? `${myWinRatePct}%` : "—"}</p>
            <p className="text-xs text-muted">نسبة نجاح صفقاتي المنسوخة</p>
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
            <p className="text-xs text-muted">متوسط عائد الصفقة</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-3">
            <p className="text-lg font-semibold">{closedPositions.length}</p>
            <p className="text-xs text-muted">عدد الصفقات المغلقة</p>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">المتداول الذي تنسخه</h2>
        {(followedProviders ?? []).length === 0 ? (
          <p className="text-sm text-muted">
            أنت لا تنسخ أي متداول حتى الآن. انتقل إلى{" "}
            <Link href="/discover" className="underline">
              اكتشاف المتداولين
            </Link>{" "}
            وابدأ النسخ.
          </p>
        ) : (
          followedProviders!.map((p) => (
            <div
              key={p.provider_id}
              className="flex items-center justify-between rounded-lg border border-border bg-surface p-3"
            >
              <Link href={`/trader/${p.provider_id}`} className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-accent to-brand text-sm font-semibold text-white">
                  {p.display_name?.charAt(0) ?? "؟"}
                </div>
                <div>
                  <p className="text-sm font-medium underline-offset-2 hover:underline">
                    {p.display_name}
                  </p>
                  <p className="text-xs text-muted">
                    مبلغ النسخ: ${Number(allocationByProvider.get(p.provider_id) ?? 0).toLocaleString("en-US")}
                  </p>
                </div>
              </Link>
              <form action={unfollowProvider}>
                <input type="hidden" name="providerId" value={p.provider_id} />
                <button
                  type="submit"
                  className="rounded border border-border px-3 py-1 text-xs"
                >
                  إيقاف النسخ
                </button>
              </form>
            </div>
          ))
        )}
      </section>
    </div>
  );

  const positionsPanel = (
    <div className="flex flex-col gap-3">
      <h2 className="font-medium">سجل الصفقات</h2>
      {closedHistory.length === 0 ? (
        <p className="text-sm text-muted">
          لا توجد صفقات منسوخة مغلقة حتى الآن. ستظهر النتائج هنا فور إغلاق أي متداول تتابعه لصفقة.
        </p>
      ) : (
        <TradeHistory trades={closedHistory} />
      )}
    </div>
  );

  const walletMovements = (transactions ?? []).filter((t) => t.type === "deposit" || t.type === "withdrawal");

  const activity = (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h2 className="font-medium">حركات المحفظة</h2>
        {walletMovements.length === 0 ? (
          <p className="text-sm text-muted">لا توجد حركات إيداع أو سحب على المحفظة حتى الآن.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-border text-right text-xs text-muted">
                  <th className="py-2 pl-3">التاريخ</th>
                  <th className="py-2 pl-3">النوع</th>
                  <th className="py-2 pl-3">المبلغ</th>
                  <th className="py-2">الرصيد بعدها</th>
                </tr>
              </thead>
              <tbody>
                {walletMovements.map((t) => (
                  <tr key={t.id} className="border-b border-border/60">
                    <td className="py-2 pl-3 whitespace-nowrap text-xs text-muted">
                      {new Date(t.created_at).toLocaleDateString("ar-EG")}
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
        <h2 className="font-medium">طلبات الإيداع والسحب</h2>
        {(walletRequests ?? []).length === 0 ? (
          <p className="text-sm text-muted">لا توجد طلبات إيداع أو سحب حتى الآن.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-border text-right text-xs text-muted">
                  <th className="py-2 pl-3">التاريخ</th>
                  <th className="py-2 pl-3">النوع</th>
                  <th className="py-2 pl-3">المبلغ</th>
                  <th className="py-2">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {walletRequests!.map((r) => (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className="py-2 pl-3 whitespace-nowrap text-xs text-muted">
                      {new Date(r.requested_at).toLocaleDateString("ar-EG")}
                    </td>
                    <td className="py-2 pl-3 whitespace-nowrap">{r.type === "deposit" ? "إيداع" : "سحب"}</td>
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
        <BackButton fallbackHref="/dashboard" />
        <h1 className="text-2xl font-semibold">محفظتي</h1>

        {error && (
          <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        {success && (
          <p className="rounded border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
            تمت العملية بنجاح.
          </p>
        )}

        <PortfolioTabs overview={overview} positions={positionsPanel} activity={activity} initialTab={tab} />
      </main>
    </>
  );
}
