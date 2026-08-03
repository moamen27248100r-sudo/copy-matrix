import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { unfollowProvider } from "@/app/discover/actions";
import { ThemeToggle } from "@/components/ThemeToggle";

export default async function PortfolioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: subscriptions } = await supabase
    .from("subscriptions")
    .select("provider_id")
    .eq("follower_id", user.id)
    .eq("is_active", true);

  const providerIds = (subscriptions ?? []).map((s) => s.provider_id);

  const [{ data: followedProviders }, { data: positions }] = await Promise.all([
    providerIds.length > 0
      ? supabase.from("provider_cards").select("*").in("provider_id", providerIds)
      : Promise.resolve({ data: [] as never[] }),
    supabase
      .from("simulated_positions")
      .select("id, entry_price, exit_price, size, status, pnl, opened_at, closed_at, signals(symbol, side, provider_id)")
      .eq("follower_id", user.id)
      .order("opened_at", { ascending: false }),
  ]);

  const allPositions = positions ?? [];
  const closedPositions = allPositions.filter((p) => p.status === "closed");
  const totalRealizedPnl = closedPositions.reduce((sum, p) => sum + (p.pnl ?? 0), 0);

  const providerNameById = new Map(
    (followedProviders ?? []).map((p) => [p.provider_id, p.display_name]),
  );

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">محفظتي</h1>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/discover" className="underline">
            اكتشاف المتداولين
          </Link>
          <ThemeToggle />
        </div>
      </div>

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
                    {p.win_rate_pct != null ? `نسبة النجاح ${p.win_rate_pct}%` : "—"}
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
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-right text-xs text-muted">
                  <th className="py-2">المتداول</th>
                  <th className="py-2">الرمز</th>
                  <th className="py-2">الاتجاه</th>
                  <th className="py-2">الدخول</th>
                  <th className="py-2">الخروج</th>
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
                      <td className="py-2">{providerName}</td>
                      <td className="py-2 font-medium">{signal?.symbol ?? "—"}</td>
                      <td
                        className={
                          signal?.side === "buy" ? "py-2 text-success" : "py-2 text-danger"
                        }
                      >
                        {signal?.side === "buy" ? "شراء" : signal?.side === "sell" ? "بيع" : "—"}
                      </td>
                      <td className="py-2">{pos.entry_price}</td>
                      <td className="py-2">{pos.exit_price}</td>
                      <td className="py-2">
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
    </main>
  );
}
