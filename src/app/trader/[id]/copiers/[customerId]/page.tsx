import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { TradeHistory } from "@/components/TradeHistory";
import { formatDate } from "@/lib/locale-format";
import type { Locale } from "@/i18n/locales";

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
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("CopierProfile");
  const supabase = await createClient();

  const customerQuery = () =>
    supabase
      .from("synthetic_customers")
      .select("id, provider_id, display_name, starting_capital, current_capital, total_deposited, joined_at")
      .eq("id", customerId)
      .eq("provider_id", id)
      .single();

  let { data: customer } = await customerQuery();

  if (!customer) {
    // Null data here can mean a genuinely nonexistent id or a transient
    // query failure -- Supabase returns the same shape either way, so
    // one retry filters out the latter instead of showing a false 404.
    ({ data: customer } = await customerQuery());
  }

  if (!customer) {
    notFound();
  }

  const [{ data: provider }, { data: signals }, { data: withdrawals }, { data: deposits }, { data: pauses }] = await Promise.all([
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
      .select("id, signal_id, amount, occurred_at")
      .eq("customer_id", customerId)
      .order("occurred_at", { ascending: false }),
    supabase
      .from("synthetic_customer_deposits")
      .select("id, amount, occurred_at")
      .eq("customer_id", customerId)
      .order("occurred_at", { ascending: false }),
    supabase
      .from("synthetic_customer_pauses")
      .select("paused_at, resumed_at, redeposit_amount")
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

  const withdrawalRows = withdrawals ?? [];
  const depositRows = deposits ?? [];
  const withdrawalBySignal = new Map(withdrawalRows.filter((w) => w.signal_id).map((w) => [w.signal_id as string, Number(w.amount)]));
  // Two kinds of balance events applied during the trade-replay walk
  // below, in chronological order: a pause resume OVERWRITES the running
  // balance with the real redeposit amount, while an "add funds" event
  // ADDS to whatever the balance already is -- merged into one
  // time-sorted stream so the walk applies them in the order they
  // actually happened.
  const balanceEvents = [
    ...pauseWindows
      .filter((p) => p.resumed_at && p.redeposit_amount != null)
      .map((p) => ({ at: new Date(p.resumed_at!).getTime(), kind: "resume" as const, amount: Number(p.redeposit_amount) })),
    ...depositRows.map((d) => ({ at: new Date(d.occurred_at).getTime(), kind: "deposit" as const, amount: Number(d.amount) })),
  ].sort((a, b) => a.at - b.at);

  // Same step-by-step walk used by scripts/backfill-synthetic-customers.mjs
  // — deterministic here since it only replays already-persisted
  // starting_capital/withdrawal/redeposit amounts, no new randomness at
  // request time. Every trade's $ P&L is exactly pct% of the customer's
  // real balance at that moment (withdrawals and pause redeposits both
  // reduce/reset that running balance, matching the live engine and
  // backfill script exactly).
  let balance = Number(customer.starting_capital);
  let eventIdx = 0;
  const derivedTrades: {
    id: string; symbol: string; side: string; entry: number; exit: number;
    pnl: number; pct: number; openedAt: string; closedAt: string | null;
  }[] = [];
  for (const s of (signals ?? []) as SignalRow[]) {
    const t = new Date(s.closed_at ?? s.opened_at).getTime();
    while (eventIdx < balanceEvents.length && balanceEvents[eventIdx].at <= t) {
      const ev = balanceEvents[eventIdx];
      balance = ev.kind === "resume" ? ev.amount : balance + ev.amount;
      eventIdx++;
    }
    if (isPaused(s.closed_at ?? s.opened_at)) continue;

    const raw = (s.exit_price - s.entry_price) / s.entry_price;
    const signed = s.side === "sell" ? -raw : raw;
    const pnl = Math.round(balance * signed * 100) / 100;
    balance = balance + pnl;
    const withdrawalAmount = withdrawalBySignal.get(s.id);
    if (withdrawalAmount) balance = Math.max(10, balance - withdrawalAmount);

    derivedTrades.push({
      id: s.id,
      symbol: s.symbol,
      side: s.side,
      entry: Number(s.entry_price),
      exit: Number(s.exit_price),
      pnl,
      pct: signed * 100,
      openedAt: s.opened_at,
      closedAt: s.closed_at,
    });
  }

  // total_deposited (starting capital + any later "add funds" events) is
  // the correct denominator once a customer can top up -- falls back to
  // starting_capital for a customer seeded before that column existed.
  const totalDeposited = Number(customer.total_deposited ?? customer.starting_capital);
  const totalGainPct =
    totalDeposited > 0 ? ((Number(customer.current_capital) - totalDeposited) / totalDeposited) * 100 : 0;

  return (
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent to-brand text-lg font-semibold text-white">
              {customer.display_name.charAt(0)}
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-semibold">{customer.display_name}</h1>
              <p className="text-sm text-muted">
                {t("copierOf", {
                  name: provider?.display_name ?? t("defaultTraderFallback"),
                  date: formatDate(customer.joined_at, locale, { year: "numeric", month: "long", day: "numeric" }),
                })}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            <div>
              <p className="font-semibold">
                ${Number(customer.starting_capital).toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-muted">{t("startingCapital")}</p>
            </div>
            <div>
              <p className={totalGainPct >= 0 ? "font-semibold text-success" : "font-semibold text-danger"} dir="ltr">
                {totalGainPct >= 0 ? "+" : ""}
                {totalGainPct.toFixed(2)}%
              </p>
              <p className="text-xs text-muted">{t("totalReturn")}</p>
            </div>
            <div>
              <p className="font-semibold">{derivedTrades.length}</p>
              <p className="text-xs text-muted">{t("tradeCount")}</p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background p-3 text-center">
            <p className="text-2xl font-bold" dir="ltr">
              ${Number(customer.current_capital).toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </p>
            <p className="text-xs text-muted">{t("currentCapital")}</p>
          </div>
        </div>

        <section className="flex flex-col gap-2">
          <h2 className="font-medium">{t("depositsWithdrawalsTitle")}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-right text-xs text-muted">
                  <th className="py-2 pl-3">{t("dateCol")}</th>
                  <th className="py-2 pl-3">{t("typeCol")}</th>
                  <th className="py-2">{t("amountCol")}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/60">
                  <td className="py-2 pl-3 whitespace-nowrap text-xs text-muted">
                    {formatDate(customer.joined_at, locale)}
                  </td>
                  <td className="py-2 pl-3 whitespace-nowrap">{t("firstDeposit")}</td>
                  <td className="py-2 whitespace-nowrap text-success" dir="ltr">
                    +${Number(customer.starting_capital).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                  </td>
                </tr>
                {[
                  ...withdrawalRows.map((w) => ({ id: w.id, occurredAt: w.occurred_at, amount: -Number(w.amount) })),
                  ...depositRows.map((d) => ({ id: d.id, occurredAt: d.occurred_at, amount: Number(d.amount) })),
                ]
                  .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
                  .map((row) => (
                    <tr key={row.id} className="border-b border-border/60">
                      <td className="py-2 pl-3 whitespace-nowrap text-xs text-muted">
                        {formatDate(row.occurredAt, locale)}
                      </td>
                      <td className="py-2 pl-3 whitespace-nowrap">{row.amount >= 0 ? t("deposit") : t("withdrawal")}</td>
                      <td className={`py-2 whitespace-nowrap ${row.amount >= 0 ? "text-success" : "text-danger"}`} dir="ltr">
                        {row.amount >= 0 ? "+" : "-"}$
                        {Math.abs(row.amount).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-medium">{t("tradeHistoryTitle")}</h2>
          {derivedTrades.length === 0 ? (
            <p className="text-sm text-muted">{t("noTradesSinceJoined")}</p>
          ) : (
            <TradeHistory trades={[...derivedTrades].reverse()} />
          )}
        </section>
      </main>
    </>
  );
}
