import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnProviderId } from "@/lib/lead-trader";
import { placeLeadOrder, closeLeadOrder } from "@/app/lead/trades/actions";

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "XAUUSD", "EURUSD", "GBPUSD", "USDJPY"];

type OpenSignal = {
  id: string;
  symbol: string;
  side: string;
  entry_price: number;
  stop_loss: number | null;
  take_profit: number | null;
  lot_size: number | null;
  opened_at: string;
};

export default async function LeadTradesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; view?: string }>;
}) {
  const { error, view } = await searchParams;
  const byAsset = view === "asset";
  const t = await getTranslations("LeadTrader.trades");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const providerId = await getOwnProviderId(supabase, user.id);
  if (!providerId) redirect("/become-lead-trader");

  const [{ count: activeFollowers }, { data: openSignals }] = await Promise.all([
    supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("provider_id", providerId).eq("is_active", true),
    supabase
      .from("signals")
      .select("id, symbol, side, entry_price, stop_loss, take_profit, lot_size, opened_at")
      .eq("provider_id", providerId)
      .eq("status", "open")
      .order("opened_at", { ascending: false }),
  ]);

  const signals = (openSignals ?? []) as OpenSignal[];
  const symbols = Array.from(new Set(signals.map((s) => s.symbol)));
  const { data: livePrices } = symbols.length
    ? await supabase.from("market_prices").select("symbol, price").in("symbol", symbols)
    : { data: [] as { symbol: string; price: number }[] };
  const priceBySymbol = new Map((livePrices ?? []).map((p) => [p.symbol, Number(p.price)]));

  // Copier counts per open order (how many followers this specific trade mirrored to).
  const signalIds = signals.map((s) => s.id);
  const { data: positionCounts } = signalIds.length
    ? await supabase.from("simulated_positions").select("signal_id").in("signal_id", signalIds)
    : { data: [] as { signal_id: string }[] };
  const copiedCountBySignal = new Map<string, number>();
  for (const p of positionCounts ?? []) copiedCountBySignal.set(p.signal_id, (copiedCountBySignal.get(p.signal_id) ?? 0) + 1);

  const pctOf = (s: OpenSignal) => {
    const current = priceBySymbol.get(s.symbol);
    if (current == null) return null;
    return ((current - s.entry_price) / s.entry_price) * (s.side === "sell" ? -1 : 1);
  };

  const byAssetRows = symbols.map((sym) => {
    const rows = signals.filter((s) => s.symbol === sym);
    const margin = rows.reduce((sum, s) => sum + Number(s.lot_size ?? 0), 0);
    const avgEntry = rows.reduce((sum, s) => sum + s.entry_price, 0) / rows.length;
    const unrealized = rows.reduce((sum, s) => {
      const pct = pctOf(s);
      return pct == null ? sum : sum + pct * Number(s.lot_size ?? 0);
    }, 0);
    return { symbol: sym, count: rows.length, margin, avgEntry, unrealized };
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-page-title">{t("title")}</h1>
      {error && <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5">
        <p className="text-sm text-muted">{t("copiedToFollowers", { count: activeFollowers ?? 0 })}</p>
        <form action={placeLeadOrder} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <select name="symbol" required className="rounded-lg border border-border bg-background px-3 py-2 text-sm" defaultValue={SYMBOLS[0]}>
            {SYMBOLS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select name="side" required className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
            <option value="buy">{t("buy")}</option>
            <option value="sell">{t("sell")}</option>
          </select>
          <input name="size" type="number" step="any" min={0} placeholder={t("size")} required className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input name="takeProfit" type="number" step="any" placeholder={t("takeProfit")} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <input name="stopLoss" type="number" step="any" placeholder={t("stopLoss")} className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          <button type="submit" className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground">
            {t("submitOrder")}
          </button>
        </form>
      </section>

      <div className="flex items-center justify-between">
        <div className="flex gap-1.5 rounded-lg border border-border bg-surface p-1">
          <Link href="/lead/trades" className={!byAsset ? "rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground" : "rounded px-3 py-1.5 text-xs text-muted"}>
            {t("byOrder")}
          </Link>
          <Link href="/lead/trades?view=asset" className={byAsset ? "rounded bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground" : "rounded px-3 py-1.5 text-xs text-muted"}>
            {t("byAsset")}
          </Link>
        </div>
        <Link href="/lead/trades/history" className="text-sm text-accent hover:underline">
          {t("history")}
        </Link>
      </div>

      {signals.length === 0 ? (
        <p className="text-sm text-muted">{t("noOpenOrders")}</p>
      ) : byAsset ? (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="px-3 py-2 text-start font-normal">{t("asset")}</th>
                <th className="px-3 py-2 text-start font-normal">{t("count")}</th>
                <th className="px-3 py-2 text-start font-normal">{t("margin")}</th>
                <th className="px-3 py-2 text-start font-normal">{t("avgEntry")}</th>
                <th className="px-3 py-2 text-start font-normal">{t("unrealized")}</th>
              </tr>
            </thead>
            <tbody>
              {byAssetRows.map((r) => (
                <tr key={r.symbol} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2 font-medium" dir="ltr">
                    {r.symbol}
                  </td>
                  <td className="px-3 py-2">{r.count}</td>
                  <td className="px-3 py-2 tabular-nums">{r.margin.toLocaleString("en-US")}</td>
                  <td className="px-3 py-2 tabular-nums">{r.avgEntry.toLocaleString("en-US", { maximumFractionDigits: 4 })}</td>
                  <td className={`px-3 py-2 tabular-nums ${r.unrealized >= 0 ? "text-success" : "text-danger"}`}>
                    {r.unrealized >= 0 ? "+" : "-"}${Math.abs(r.unrealized).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {signals.map((s) => {
            const pct = pctOf(s);
            return (
              <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium" dir="ltr">
                    {s.symbol} <span className={s.side === "buy" ? "text-accent" : "text-danger"}>{s.side === "buy" ? t("buy") : t("sell")}</span>
                  </p>
                  <p className="text-xs text-muted tabular-nums" dir="ltr">
                    {s.entry_price} · {t("copiers")}: {copiedCountBySignal.get(s.id) ?? 0}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm tabular-nums ${pct != null && pct >= 0 ? "text-success" : "text-danger"}`} dir="ltr">
                    {pct != null ? `${pct >= 0 ? "+" : ""}${(pct * 100).toFixed(2)}%` : "—"}
                  </span>
                  <form action={closeLeadOrder}>
                    <input type="hidden" name="signalId" value={s.id} />
                    <button type="submit" className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:border-danger/50 hover:text-danger">
                      {t("closeOrder")}
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
