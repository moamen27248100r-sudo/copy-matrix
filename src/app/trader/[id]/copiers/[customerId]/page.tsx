import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { BackButton } from "@/components/BackButton";
import { TradeHistory } from "@/components/TradeHistory";

type SignalRow = {
  id: string;
  symbol: string;
  side: string;
  entry_price: number;
  exit_price: number;
  opened_at: string;
  closed_at: string | null;
};

export default async function CopierProfilePage({
  params,
}: {
  params: Promise<{ id: string; customerId: string }>;
}) {
  const { id, customerId } = await params;
  const supabase = await createClient();

  const { data: customer } = await supabase
    .from("synthetic_customers")
    .select("id, provider_id, display_name, starting_capital, current_capital, joined_at")
    .eq("id", customerId)
    .eq("provider_id", id)
    .single();

  if (!customer) {
    notFound();
  }

  const [{ data: provider }, { data: signals }, { data: withdrawals }, { data: pauses }] = await Promise.all([
    supabase.from("provider_cards").select("display_name").eq("provider_id", id).single(),
    supabase
      .from("signals")
      .select("id, symbol, side, entry_price, exit_price, opened_at, closed_at")
      .eq("provider_id", id)
      .eq("status", "closed")
      .not("exit_price", "is", null)
      .gte("opened_at", customer.joined_at)
      .order("closed_at", { ascending: true }),
    supabase
      .from("synthetic_customer_withdrawals")
      .select("id, amount, occurred_at")
      .eq("customer_id", customerId)
      .order("occurred_at", { ascending: false }),
    supabase
      .from("synthetic_customer_pauses")
      .select("paused_at, resumed_at")
      .eq("customer_id", customerId)
      .order("paused_at", { ascending: true }),
  ]);

  const pauseWindows = pauses ?? [];
  function isPaused(iso: string) {
    const t = new Date(iso).getTime();
    return pauseWindows.some((p) => {
      const start = new Date(p.paused_at).getTime();
      const end = p.resumed_at ? new Date(p.resumed_at).getTime() : Infinity;
      // strictly after paused_at: the trade that triggered the pause
      // already applied to this customer's capital, so it stays in history
      return t > start && t < end;
    });
  }

  const qualifyingSignals = ((signals ?? []) as SignalRow[]).filter((s) => !isPaused(s.closed_at ?? s.opened_at));
  const withdrawalRows = withdrawals ?? [];

  // Same step-by-step walk used by scripts/backfill-synthetic-customers.mjs —
  // deterministic here since it only replays already-persisted
  // starting_capital/withdrawal amounts, no new randomness at request time.
  let balance = Number(customer.starting_capital);
  const derivedTrades = qualifyingSignals.map((s) => {
    const raw = (s.exit_price - s.entry_price) / s.entry_price;
    const signed = s.side === "sell" ? -raw : raw;
    const pnl = Math.round(balance * signed * 100) / 100;
    balance = balance + pnl;
    return {
      id: s.id,
      symbol: s.symbol,
      side: s.side,
      entry: Number(s.entry_price),
      exit: Number(s.exit_price),
      pnl,
      pct: signed * 100,
      openedAt: s.opened_at,
      closedAt: s.closed_at,
    };
  });

  const totalGainPct =
    Number(customer.starting_capital) > 0
      ? ((Number(customer.current_capital) - Number(customer.starting_capital)) / Number(customer.starting_capital)) * 100
      : 0;

  return (
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
        <BackButton fallbackHref={`/trader/${id}`} />

        <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-brand text-lg font-semibold text-white">
              {customer.display_name.charAt(0)}
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-semibold">{customer.display_name}</h1>
              <p className="text-sm text-muted">
                ناسخ صفقات {provider?.display_name ?? "المتداول"} · منذ{" "}
                {new Date(customer.joined_at).toLocaleDateString("ar-EG", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            <div>
              <p className="font-semibold">
                ${Number(customer.starting_capital).toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-muted">رأس المال الأولي</p>
            </div>
            <div>
              <p className={totalGainPct >= 0 ? "font-semibold text-success" : "font-semibold text-danger"} dir="ltr">
                {totalGainPct >= 0 ? "+" : ""}
                {totalGainPct.toFixed(2)}%
              </p>
              <p className="text-xs text-muted">إجمالي العائد</p>
            </div>
            <div>
              <p className="font-semibold">{derivedTrades.length}</p>
              <p className="text-xs text-muted">صفقة</p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background p-3 text-center">
            <p className="text-2xl font-bold" dir="ltr">
              ${Number(customer.current_capital).toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-muted">رأس المال الحالي</p>
          </div>
        </div>

        <section className="flex flex-col gap-2">
          <h2 className="font-medium">الإيداعات والسحوبات</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-border text-right text-xs text-muted">
                  <th className="py-2 pl-3">التاريخ</th>
                  <th className="py-2 pl-3">النوع</th>
                  <th className="py-2">المبلغ</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/60">
                  <td className="py-2 pl-3 whitespace-nowrap text-xs text-muted">
                    {new Date(customer.joined_at).toLocaleDateString("ar-EG")}
                  </td>
                  <td className="py-2 pl-3 whitespace-nowrap">إيداع أول</td>
                  <td className="py-2 whitespace-nowrap text-success">
                    +{Number(customer.starting_capital).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                  </td>
                </tr>
                {withdrawalRows.map((w) => (
                  <tr key={w.id} className="border-b border-border/60">
                    <td className="py-2 pl-3 whitespace-nowrap text-xs text-muted">
                      {new Date(w.occurred_at).toLocaleDateString("ar-EG")}
                    </td>
                    <td className="py-2 pl-3 whitespace-nowrap">سحب</td>
                    <td className="py-2 whitespace-nowrap text-danger">
                      -{Number(w.amount).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-medium">سجل الصفقات</h2>
          {derivedTrades.length === 0 ? (
            <p className="text-sm text-muted">لا توجد صفقات مغلقة منذ انضمام هذا العميل.</p>
          ) : (
            <TradeHistory trades={[...derivedTrades].reverse()} />
          )}
        </section>
      </main>
    </>
  );
}
