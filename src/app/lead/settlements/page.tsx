import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnProviderId } from "@/lib/lead-trader";
import { LEAD_TRADER_MONEY_ENABLED } from "@/config/lead-trader";
import { runOwnSettlement } from "@/app/lead/settlements/actions";

function maskEmail(email: string | null, id: string) {
  if (!email) return `${id.slice(0, 4)}****`;
  const [local, domain] = email.split("@");
  if (!domain) return email;
  return local.length <= 2 ? `${local[0]}****@${domain}` : `${local[0]}****${local[local.length - 1]}@${domain}`;
}

export default async function LeadSettlementsPage() {
  const t = await getTranslations("LeadTrader.settlements");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const providerId = await getOwnProviderId(supabase, user.id);
  if (!providerId) redirect("/become-lead-trader");

  const [{ data: ledger }, { data: provider }, { data: subs }] = await Promise.all([
    supabase
      .from("profit_share_ledger")
      .select("id, follower_id, period_start, period_end, gross_pnl, profit_share_pct, profit_share_amount, status, settled_at")
      .eq("provider_id", providerId)
      .order("period_end", { ascending: false })
      .limit(100),
    supabase.from("providers").select("profit_share_pct").eq("id", providerId).single(),
    supabase.from("subscriptions").select("id, follower_id, is_active").eq("provider_id", providerId).eq("is_active", true),
  ]);

  const rows = ledger ?? [];
  const followerIds = Array.from(new Set(rows.map((r) => r.follower_id)));
  const { data: followerProfiles } = followerIds.length
    ? await supabase.from("profiles").select("id, email").in("id", followerIds)
    : { data: [] as { id: string; email: string | null }[] };
  const emailById = new Map((followerProfiles ?? []).map((p) => [p.id, p.email]));

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

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t("realized")} value={realized} />
        <Stat label={t("settled")} value={settled} />
        <Stat label={t("pending")} value={pending} />
        <Stat label={t("unrealized")} value={unrealizedShare} />
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
                    +${Number(r.gross_pnl).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{r.profit_share_pct}%</td>
                  <td className="px-3 py-2 tabular-nums" dir="ltr">
                    ${Number(r.profit_share_amount).toFixed(2)}
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="num text-lg font-semibold" dir="ltr">
        ${value.toFixed(2)}
      </p>
    </div>
  );
}
