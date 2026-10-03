import { getMoney } from "@/lib/money-server";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnProviderId } from "@/lib/lead-trader";
import { LEAD_TRADER_MONEY_ENABLED } from "@/config/lead-trader";
import { runOwnSettlement, requestPayout, cancelPayout } from "@/app/lead/settlements/actions";
import { ConfirmButton } from "@/components/ConfirmButton";

function maskEmail(name: string | null, id: string) {
  return name ?? `${id.slice(0, 4)}****`;
}

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("leadSettlementsTitle"), description: t("leadSettlementsDesc") };
}

type Earnings = {
  rate: number;
  settled_total: number;
  pending_total: number;
  available: number;
  hwm_total: number;
  monthly: { month: string; new_profit_above_hwm: number; share: number; settled: number | null; pending: number | null }[];
};

type Payout = { id: string; amount: number; destination: string; status: string; admin_note: string | null; created_at: string };

export default async function LeadSettlementsPage({ searchParams }: { searchParams: Promise<{ err?: string; ok?: string }> }) {
  const { err, ok } = await searchParams;
  const t = await getTranslations("LeadTrader.settlements");
  const money = await getMoney();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Flead%2Fsettlements");

  const providerId = await getOwnProviderId(supabase, user.id);
  if (!providerId) redirect("/become-lead-trader");

  const [{ data: ledger }, { data: provider }, { data: subs }, { data: earningsData }, { data: payoutRows }] = await Promise.all([
    supabase
      .from("profit_share_ledger")
      .select("id, follower_id, period_start, period_end, gross_pnl, profit_share_pct, profit_share_amount, status, settled_at")
      .eq("provider_id", providerId)
      .order("period_end", { ascending: false })
      .limit(100),
    supabase.from("providers").select("profit_share_pct").eq("id", providerId).single(),
    supabase.from("subscriptions").select("id, follower_id, is_active").eq("provider_id", providerId).eq("is_active", true),
    supabase.rpc("lead_dashboard_earnings"),
    supabase.from("lead_trader_payout_requests").select("id, amount, destination, status, admin_note, created_at").order("created_at", { ascending: false }).limit(20),
  ]);
  const earnings = earningsData as Earnings | null;
  const payouts = (payoutRows ?? []) as Payout[];
  const hasPending = payouts.some((p) => p.status === "pending");

  const rows = ledger ?? [];
  const followerIds = Array.from(new Set(rows.map((r) => r.follower_id)));
  const { data: followerProfiles } = followerIds.length
    ? await supabase.rpc("lead_trader_follower_labels", { p_ids: followerIds })
    : { data: [] as { id: string; display_name: string | null }[] };
  const emailById = new Map(((followerProfiles ?? []) as { id: string; display_name: string | null }[]).map((p) => [p.id, p.display_name] as const));

  const realized = rows.reduce((sum, r) => sum + Number(r.profit_share_amount), 0);
  const settled = rows.filter((r) => r.status === "settled").reduce((sum, r) => sum + Number(r.profit_share_amount), 0);
  const pending = rows.filter((r) => r.status === "pending").reduce((sum, r) => sum + Number(r.profit_share_amount), 0);

  // Unrealized: same live estimate as the overview card (Phase 2), from
  // currently open positions -- never written to the ledger, purely a preview.
  const sharePct = Number(provider?.profit_share_pct ?? 0);
  const subIds = (subs ?? []).map((s) => s.id);
  const { data: openPositions } = subIds.length
    ? await supabase.from("simulated_positions").select("subscription_id, entry_price, size, signals(symbol, side)").in("subscription_id", subIds).eq("status", "open")
    : { data: [] as { subscription_id: string; entry_price: number; size: number; signals: { symbol: string; side: string } | { symbol: string; side: string }[] | null }[] };
  const symbols = Array.from(new Set((openPositions ?? []).map((p) => (Array.isArray(p.signals) ? p.signals[0] : p.signals)?.symbol).filter((s): s is string => !!s)));
  const { data: livePrices } = symbols.length ? await supabase.from("market_prices").select("symbol, price").in("symbol", symbols) : { data: [] as { symbol: string; price: number }[] };
  const priceBySymbol = new Map((livePrices ?? []).map((p) => [p.symbol, Number(p.price)]));
  const unrealizedProfit = (openPositions ?? []).reduce((sum, p) => {
    const sig = Array.isArray(p.signals) ? p.signals[0] : p.signals;
    const current = sig ? priceBySymbol.get(sig.symbol) : undefined;
    if (current == null || !sig) return sum;
    const pct = ((current - p.entry_price) / p.entry_price) * (sig.side === "sell" ? -1 : 1);
    return sum + pct * Number(p.size);
  }, 0);
  const unrealizedShare = Math.max(0, unrealizedProfit) * (sharePct / 100);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-page-title">{t("title")}</h1>
        <form action={runOwnSettlement}>
          <button type="submit" className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground">
            {t("runNow")}
          </button>
        </form>
      </div>

      {!LEAD_TRADER_MONEY_ENABLED && <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">{t("flagOffNotice")}</p>}

      {err && <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{t(["payoutErrMin", "payoutErrDestination", "payoutErrPending", "payoutErrAvailable"].includes(err) ? err : "payoutErrGeneric")}</p>}
      {ok && <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">{t("payoutRequested")}</p>}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t("availableToWithdraw")} value={money(Number(earnings?.available ?? 0))} />
        <Stat label={t("profitShareRate")} value={`${Number(earnings?.rate ?? 0)}%`} />
        <Stat label={t("hwmTotal")} value={money(Number(earnings?.hwm_total ?? 0))} />
      </section>
      <p className="-mt-4 text-xs text-muted">{t("hwmNote")}</p>

      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-section-title">{t("payoutTitle")}</h2>
        {hasPending ? (
          <p className="text-sm text-muted">{t("payoutPendingNotice")}</p>
        ) : (
          <form action={requestPayout} className="flex flex-col gap-2 sm:flex-row">
            <input name="amount" type="number" min={10} step="any" max={Number(earnings?.available ?? 0)} required placeholder={t("payoutAmount")} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base sm:w-32" dir="ltr" />
            <input name="destination" type="text" minLength={3} maxLength={300} required placeholder={t("payoutDestination")} className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-base" dir="auto" />
            <button type="submit" disabled={Number(earnings?.available ?? 0) < 10} className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40">
              {t("payoutRequest")}
            </button>
          </form>
        )}
        {!hasPending && Number(earnings?.available ?? 0) < 10 && (
          <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">{t("payoutDisabledReason", { available: money(Number(earnings?.available ?? 0)) })}</p>
        )}
        <p className="text-xs text-muted">{t("payoutMinNote")}</p>
        {payouts.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {payouts.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs">
                <span className="tabular-nums" dir="ltr">
                  {money(Number(p.amount))} · {new Date(p.created_at).toLocaleDateString("en-US")}
                </span>
                <span className="flex items-center gap-2">
                  <span className={p.status === "approved" ? "text-success" : p.status === "pending" ? "text-warning" : "text-muted"}>{t(`payout_${p.status}`)}</span>
                  {p.status === "pending" && (
                    <form action={cancelPayout}>
                      <input type="hidden" name="id" value={p.id} />
                      <ConfirmButton confirmText={t("payoutCancelConfirm")} className="text-danger hover:underline">
                        {t("payoutCancel")}
                      </ConfirmButton>
                    </form>
                  )}
                </span>
                {p.admin_note && <span className="w-full text-muted">{p.admin_note}</span>}
              </div>
            ))}
          </div>
        )}
      </section>

      {earnings && earnings.monthly.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-section-title">{t("monthlyTitle")}</h2>
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted">
                  <th className="px-3 py-2 text-start font-normal">{t("month")}</th>
                  <th className="px-3 py-2 text-start font-normal">{t("newProfit")}</th>
                  <th className="px-3 py-2 text-start font-normal">{t("amount")}</th>
                  <th className="px-3 py-2 text-start font-normal">{t("settled")}</th>
                  <th className="px-3 py-2 text-start font-normal">{t("pending")}</th>
                </tr>
              </thead>
              <tbody>
                {earnings.monthly.map((m) => (
                  <tr key={m.month} className="border-b border-border last:border-b-0 tabular-nums" dir="ltr">
                    <td className="px-3 py-2 text-start">{m.month}</td>
                    <td className="px-3 py-2 text-start">{money(Number(m.new_profit_above_hwm))}</td>
                    <td className="px-3 py-2 text-start">{money(Number(m.share))}</td>
                    <td className="px-3 py-2 text-start">{money(Number(m.settled ?? 0))}</td>
                    <td className="px-3 py-2 text-start">{money(Number(m.pending ?? 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t("realized")} value={money(realized)} />
        <Stat label={t("settled")} value={money(settled)} />
        <Stat label={t("pending")} value={money(pending)} />
        <Stat label={t("unrealized")} value={money(unrealizedShare)} />
      </section>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">{t("noRecords")}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="px-3 py-2 text-start font-normal">{t("follower")}</th>
                <th className="px-3 py-2 text-start font-normal">{t("period")}</th>
                <th className="px-3 py-2 text-start font-normal">{t("grossPnl")}</th>
                <th className="px-3 py-2 text-start font-normal">{t("rate")}</th>
                <th className="px-3 py-2 text-start font-normal">{t("amount")}</th>
                <th className="px-3 py-2 text-start font-normal">{t("status")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2" dir="ltr">
                    {maskEmail(emailById.get(r.follower_id) ?? null, r.follower_id)}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted tabular-nums" dir="ltr">
                    {new Date(r.period_start).toLocaleDateString("en-US")} → {new Date(r.period_end).toLocaleDateString("en-US")}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-success" dir="ltr">
                    {money(Number(r.gross_pnl), { signed: true })}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{r.profit_share_pct}%</td>
                  <td className="px-3 py-2 tabular-nums" dir="ltr">
                    {money(Number(r.profit_share_amount))}
                  </td>
                  <td className="px-3 py-2">
                    <span className={r.status === "settled" ? "text-success" : r.status === "pending" ? "text-warning" : "text-muted"}>{t(`status_${r.status}`)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="num text-lg font-semibold" dir="ltr">
        {value}
      </p>
    </div>
  );
}
