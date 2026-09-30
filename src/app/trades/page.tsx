import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/AppNav";
import { ConfirmButton } from "@/components/ConfirmButton";
import { MyOpenPositions } from "@/components/MyOpenPositions";
import { TradeHistory } from "@/components/TradeHistory";
import { closeAllPositions } from "@/app/trades/actions";
import { fetchClosedTrades } from "@/lib/my-trades";

type PositionSignal = { symbol: string; side: string; stop_loss: number | null; take_profit: number | null };

export async function generateMetadata() {
  const t = await getTranslations("Metadata");
  return { title: t("tradesTitle"), description: t("tradesDesc") };
}

export default async function TradesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; symbol?: string; provider?: string; result?: string; days?: string; error?: string }>;
}) {
  const { tab, symbol, provider, result, days, error } = await searchParams;
  const activeTab = tab === "history" ? "history" : "open";
  const t = await getTranslations("Trades");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Ftrades");

  const daysNum = Number(days);
  const { data: openRows } = await supabase
    .from("simulated_positions")
    .select("id, entry_price, size, signals(symbol, side, stop_loss, take_profit)")
    .eq("follower_id", user.id)
    .eq("status", "open")
    .order("opened_at", { ascending: false });

  const open = (openRows ?? []).flatMap((r) => {
    const s = (Array.isArray(r.signals) ? r.signals[0] : r.signals) as PositionSignal | null;
    if (!s) return [];
    return [
      {
        id: r.id as string,
        symbol: s.symbol,
        side: s.side,
        entry_price: Number(r.entry_price),
        size: Number(r.size),
        take_profit: s.take_profit,
        stop_loss: s.stop_loss,
      },
    ];
  });
  const symbols = Array.from(new Set(open.map((p) => p.symbol)));
  const { data: prices } = symbols.length
    ? await supabase.from("market_prices").select("symbol, price").in("symbol", symbols)
    : { data: [] as { symbol: string; price: number }[] };
  const initialPrices = Object.fromEntries((prices ?? []).map((p) => [p.symbol, Number(p.price)]));

  const filters = {
    symbol: symbol || undefined,
    provider: provider || undefined,
    result: result || undefined,
    days: Number.isFinite(daysNum) && daysNum > 0 ? daysNum : undefined,
  };
  const history =
    activeTab === "history"
      ? await fetchClosedTrades(supabase, user.id, filters)
      : { trades: [], symbols: [] as string[], providers: [] as { id: string; name: string }[] };

  const exportQs = new URLSearchParams(Object.entries({ symbol, provider, result, days }).filter(([, v]) => !!v) as [string, string][]);
  const select = "rounded border border-border bg-background px-2 py-1.5 text-sm";

  return (
    <>
      <AppNav />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6 pb-[calc(var(--bottom-nav-h)+1.5rem)] lg:ms-64 lg:me-0 lg:pb-6">
        <h1 className="text-page-title">{t("title")}</h1>
        {error && <p className="rounded border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        <div className="flex gap-1.5 rounded-lg border border-border bg-surface p-1">
          {(["open", "history"] as const).map((k) => (
            <Link
              key={k}
              href={`/trades?tab=${k}`}
              className={
                activeTab === k
                  ? "flex-1 rounded bg-accent px-3 py-2 text-center text-sm font-medium text-accent-foreground"
                  : "flex-1 rounded px-3 py-2 text-center text-sm text-muted hover:text-foreground"
              }
            >
              {t(k === "open" ? "tabOpen" : "tabHistory")}
            </Link>
          ))}
        </div>

        {activeTab === "open" ? (
          <>
            {open.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted">{t("editTpSlSoon")}</p>
                <form action={closeAllPositions}>
                  <ConfirmButton
                    confirmText={t("closeAllConfirm", { count: open.length })}
                    className="rounded-lg border border-danger/50 px-3 py-1.5 text-xs font-medium text-danger transition hover:bg-danger/10"
                  >
                    {t("closeAll")}
                  </ConfirmButton>
                </form>
              </div>
            )}
            <MyOpenPositions positions={open} initialPrices={initialPrices} />
          </>
        ) : (
          <>
            <form method="get" className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="tab" value="history" />
              <select name="symbol" defaultValue={symbol ?? ""} className={select} aria-label={t("filterSymbol")}>
                <option value="">{t("filterSymbol")}</option>
                {history.symbols.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select name="provider" defaultValue={provider ?? ""} className={select} aria-label={t("filterTrader")}>
                <option value="">{t("filterTrader")}</option>
                {history.providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <select name="result" defaultValue={result ?? ""} className={select} aria-label={t("filterResult")}>
                <option value="">{t("filterResult")}</option>
                <option value="win">{t("resultWin")}</option>
                <option value="loss">{t("resultLoss")}</option>
              </select>
              <select name="days" defaultValue={days ?? ""} className={select} aria-label={t("filterPeriod")}>
                <option value="">{t("filterPeriod")}</option>
                {[7, 30, 90, 180, 365].map((d) => (
                  <option key={d} value={d}>
                    {t("lastDays", { days: d })}
                  </option>
                ))}
              </select>
              <button type="submit" className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground">
                {t("apply")}
              </button>
              <a
                href={`/trades/export?${exportQs.toString()}`}
                className="ms-auto rounded border border-border px-3 py-1.5 text-sm text-foreground hover:border-accent"
              >
                {t("exportCsv")}
              </a>
            </form>
            {history.trades.length === 0 ? (
              <p className="text-sm text-muted">{t("noHistory")}</p>
            ) : (
              <TradeHistory trades={history.trades} />
            )}
          </>
        )}
      </main>
    </>
  );
}
