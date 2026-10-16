import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { InstrumentIcon } from "@/components/markets/MarketsBoard";
import { getLiveInstruments } from "@/lib/market-data";
import { DEFAULT_WATCHLIST, formatPrice } from "@/lib/markets";
import { toggleWatch } from "@/app/markets/actions";

// The customer's watchlist on the home page (six well-known instruments are put there when the
// account is created; the star on any instrument adds or removes one).
export async function HomeWatchlist({ userId }: { userId: string }) {
  const t = await getTranslations("Dashboard");
  const tm = await getTranslations("Markets");
  const supabase = await createClient();
  const [{ data: watch }, live, { data: alerts }] = await Promise.all([
    supabase.from("market_watchlist").select("symbol, created_at").eq("user_id", userId).order("created_at", { ascending: true }),
    getLiveInstruments(),
    supabase.from("price_alerts").select("symbol").eq("user_id", userId).eq("status", "active"),
  ]);
  const alertCount = new Map<string, number>();
  for (const a of alerts ?? []) alertCount.set(String(a.symbol), (alertCount.get(String(a.symbol)) ?? 0) + 1);
  const bySymbol = new Map(live.map((r) => [r.symbol, r]));
  const rows = (watch ?? []).flatMap((w) => {
    const r = bySymbol.get(w.symbol as string);
    return r ? [r] : [];
  });

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-section-title">{t("watchlistTitle")}</h2>
        <Link href="/discover?tab=markets" className="text-sm text-accent-text hover:underline">
          {tm("backToMarkets")}
        </Link>
      </div>
      {rows.length === 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted">{t("watchlistSuggestHint")}</p>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {DEFAULT_WATCHLIST.flatMap((sym) => {
              const r = bySymbol.get(sym);
              return r ? [r] : [];
            })
              .slice(0, 4)
              .map((r) => (
                <li key={r.symbol} className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-2.5">
                  <Link href={`/markets/${r.symbol}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <InstrumentIcon glyph={r.instrument.glyph} toneClass={r.instrument.tone} size="h-8 w-8" />
                    <span className="min-w-0">
                      <span dir="ltr" className="block truncate text-sm font-bold">
                        {r.instrument.label}
                      </span>
                      <span className="block truncate text-xs text-muted">{r.instrument.name}</span>
                    </span>
                  </Link>
                  <form action={toggleWatch} className="shrink-0">
                    <input type="hidden" name="symbol" value={r.symbol} />
                    <input type="hidden" name="returnTo" value="/dashboard" />
                    <button
                      type="submit"
                      aria-label={`${tm("watch")} ${r.instrument.label}`}
                      title={tm("watch")}
                      className="tap-44 flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted transition hover:border-warning/50 hover:text-warning"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
                      </svg>
                    </button>
                  </form>
                </li>
              ))}
          </ul>
        </div>
      ) : (
        <WatchlistGrid items={rows.slice(0, 6).map((r) => ({ symbol: r.symbol, label: r.instrument.label, name: r.instrument.name, glyph: r.instrument.glyph, tone: r.instrument.tone, price: r.price, decimals: r.instrument.decimals, change: r.change_pct, alerts: alertCount.get(r.symbol) ?? 0 }))} alertLabel={(n) => tm("alertsActiveCount", { count: n })} />
      )}
    </section>
  );
}

export type WatchItem = { symbol: string; label: string; name: string; glyph: string; tone: string; price: number; decimals: number; change: number | null; alerts?: number };

// The watchlist rows. The home-page mock-up renders the same rows with fixed values.
export function WatchlistGrid({ items, alertLabel }: { items: WatchItem[]; alertLabel?: (count: number) => string }) {
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {items.map((r) => {
        const pct = r.change;
        return (
          <li key={r.symbol}>
            <Link
              href={`/markets/${r.symbol}`}
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-2.5 transition hover:border-accent/40"
            >
              <InstrumentIcon glyph={r.glyph} toneClass={r.tone} size="h-8 w-8" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span dir="ltr" className="truncate text-sm font-bold">
                    {r.label}
                  </span>
                  {!!r.alerts && alertLabel && (
                    <span title={alertLabel(r.alerts)} aria-label={alertLabel(r.alerts)} className="shrink-0 text-accent-text">
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                      </svg>
                    </span>
                  )}
                </span>
                <span className="block truncate text-xs text-muted">{r.name}</span>
              </span>
              <span className="shrink-0 text-end">
                <span dir="ltr" className="block text-sm tabular-nums">
                  {formatPrice(r.price, r.decimals)}
                </span>
                <span dir="ltr" className={`block text-xs font-bold tabular-nums ${pct == null ? "text-muted" : pct >= 0 ? "text-success" : "text-danger"}`}>
                  {pct == null ? "—" : `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
