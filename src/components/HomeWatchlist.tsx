import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { InstrumentIcon } from "@/components/markets/MarketsBoard";
import { getLiveInstruments } from "@/lib/market-data";
import { formatPrice } from "@/lib/markets";

// The customer's watchlist on the home page (six well-known instruments are put there when the
// account is created; the star on any instrument adds or removes one).
export async function HomeWatchlist({ userId }: { userId: string }) {
  const t = await getTranslations("Dashboard");
  const tm = await getTranslations("Markets");
  const supabase = await createClient();
  const [{ data: watch }, live] = await Promise.all([
    supabase.from("market_watchlist").select("symbol, created_at").eq("user_id", userId).order("created_at", { ascending: true }),
    getLiveInstruments(),
  ]);
  const bySymbol = new Map(live.map((r) => [r.symbol, r]));
  const rows = (watch ?? []).flatMap((w) => {
    const r = bySymbol.get(w.symbol as string);
    return r ? [r] : [];
  });

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">{t("watchlistTitle")}</h2>
        <Link href="/discover?tab=markets" className="text-sm text-accent hover:underline">
          {tm("backToMarkets")}
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">{t("watchlistEmpty")}</p>
      ) : (
        <WatchlistGrid items={rows.slice(0, 6).map((r) => ({ symbol: r.symbol, label: r.instrument.label, name: r.instrument.name, glyph: r.instrument.glyph, tone: r.instrument.tone, price: r.price, decimals: r.instrument.decimals, change: r.change_pct }))} />
      )}
    </section>
  );
}

export type WatchItem = { symbol: string; label: string; name: string; glyph: string; tone: string; price: number; decimals: number; change: number | null };

// The watchlist rows. The home-page mock-up renders the same rows with fixed values.
export function WatchlistGrid({ items }: { items: WatchItem[] }) {
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
                <span dir="ltr" className="block truncate text-sm font-semibold">
                  {r.label}
                </span>
                <span className="block truncate text-xs text-muted">{r.name}</span>
              </span>
              <span className="shrink-0 text-end">
                <span dir="ltr" className="block text-sm tabular-nums">
                  {formatPrice(r.price, r.decimals)}
                </span>
                <span dir="ltr" className={`block text-xs font-semibold tabular-nums ${pct == null ? "text-muted" : pct >= 0 ? "text-success" : "text-danger"}`}>
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
