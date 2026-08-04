import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { unfollowProvider } from "@/app/discover/actions";
import { requestDeposit, requestWithdrawal } from "@/app/portfolio/actions";
import { AppNav } from "@/components/AppNav";

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

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;
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

  const [{ data: profile }, { data: followedProviders }, { data: positions }, { data: transactions }, { data: pendingRequests }] =
    await Promise.all([
      supabase.from("profiles").select("balance").eq("id", user.id).single(),
      providerIds.length > 0
        ? supabase.from("provider_cards").select("*").in("provider_id", providerIds)
        : Promise.resolve({ data: [] as never[] }),
      supabase
        .from("simulated_positions")
        .select("id, entry_price, exit_price, size, status, pnl, opened_at, closed_at, signals(symbol, side, provider_id)")
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
        .eq("status", "pending")
        .order("requested_at", { ascending: false }),
    ]);

  const allPositions = positions ?? [];
  const closedPositions = allPositions.filter((p) => p.status === "closed");
  const totalRealizedPnl = closedPositions.reduce((sum, p) => sum + (p.pnl ?? 0), 0);

  const providerNameById = new Map(
    (followedProviders ?? []).map((p) => [p.provider_id, p.display_name]),
  );

  return (
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
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

        <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
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

          {(pendingRequests ?? []).length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted">طلبات قيد المراجعة</p>
              {pendingRequests!.map((r) => (
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

        <div className="grid grid-cols-2 gap-3 text-center text-sm">
        <div className="rounded-lg border border-border bg-surface p-3">
          <p
            className={
              totalRealizedPnl >= 0
                ? "text-lg font-semibold text-success"
                : "text-lg font-semibold text-danger"
            }
          >
            {totalRealizedPnl >= 0 ? "+" : ""}
            {totalRealizedPnl.toFixed(2)}
          </p>
          <p className="text-xs text-muted">صافي الأرباح المحققة</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="text-lg font-semibold">{closedPositions.length}</p>
          <p className="text-xs text-muted">عدد الصفقات المغلقة</p>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">المتداولون الذين تتابعهم</h2>
        {(followedProviders ?? []).length === 0 ? (
          <p className="text-sm text-muted">
            أنت لا تتابع أي متداول حتى الآن. انتقل إلى{" "}
            <Link href="/discover" className="underline">
              اكتشاف المتداولين
            </Link>{" "}
            وابدأ المتابعة.
          </p>
        ) : (
          followedProviders!.map((p) => (
            <div
              key={p.provider_id}
              className="flex items-center justify-between rounded-lg border border-border bg-surface p-3"
            >
              <Link href={`/trader/${p.provider_id}`} className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-sm text-background">
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
                  إلغاء المتابعة
                </button>
              </form>
            </div>
          ))
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">الصفقات المنسوخة المغلقة</h2>
        {closedPositions.length === 0 ? (
          <p className="text-sm text-muted">
            لا توجد صفقات منسوخة مغلقة حتى الآن. ستظهر النتائج هنا فور إغلاق أي متداول تتابعه لصفقة.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border text-right text-xs text-muted">
                  <th className="py-2 pl-3">المتداول</th>
                  <th className="py-2 pl-3">الرمز</th>
                  <th className="py-2 pl-3">الاتجاه</th>
                  <th className="py-2 pl-3">الدخول</th>
                  <th className="py-2 pl-3">الخروج</th>
                  <th className="py-2">النتيجة</th>
                </tr>
              </thead>
              <tbody>
                {closedPositions.map((pos) => {
                  const signal = Array.isArray(pos.signals) ? pos.signals[0] : pos.signals;
                  const providerName = signal
                    ? providerNameById.get(signal.provider_id) ?? "—"
                    : "—";
                  const isWin = (pos.pnl ?? 0) >= 0;
                  return (
                    <tr key={pos.id} className="border-b border-border/60">
                      <td className="py-2 pl-3 whitespace-nowrap">{providerName}</td>
                      <td className="py-2 pl-3 whitespace-nowrap font-medium">{signal?.symbol ?? "—"}</td>
                      <td
                        className={
                          signal?.side === "buy" ? "py-2 pl-3 whitespace-nowrap text-success" : "py-2 pl-3 whitespace-nowrap text-danger"
                        }
                      >
                        {signal?.side === "buy" ? "شراء" : signal?.side === "sell" ? "بيع" : "—"}
                      </td>
                      <td className="py-2 pl-3 whitespace-nowrap">{Number(pos.entry_price).toLocaleString("en-US", { maximumFractionDigits: 4 })}</td>
                      <td className="py-2 pl-3 whitespace-nowrap">{Number(pos.exit_price).toLocaleString("en-US", { maximumFractionDigits: 4 })}</td>
                      <td className="py-2 whitespace-nowrap">
                        <span className={isWin ? "text-success" : "text-danger"}>
                          {isWin ? "ربح" : "خسارة"} {(pos.pnl ?? 0) >= 0 ? "+" : ""}
                          {(pos.pnl ?? 0).toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">حركات المحفظة</h2>
        {(transactions ?? []).length === 0 ? (
          <p className="text-sm text-muted">لا توجد حركات على المحفظة حتى الآن.</p>
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
                {transactions!.map((t) => (
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
      </main>
    </>
  );
}
