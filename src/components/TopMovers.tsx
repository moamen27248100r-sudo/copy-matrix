import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { InstrumentIcon } from "@/components/markets/MarketsBoard";
import { getLiveInstruments } from "@/lib/market-data";
import { formatPrice } from "@/lib/markets";
import { MoversTabs } from "@/components/home/MoversTabs";

// "Market moves" on the home page: the real top gainers and top losers of the last 24 hours across all
// the instruments, in two tabs. Instruments the customer already has in their watchlist are left out
// (the watchlist section shows those), and an instrument without a working price is skipped.
const PER_TAB = 5;
export async function TopMovers({ excludeSymbols = [] }: { excludeSymbols?: string[] }) {
  const t = await getTranslations("Dashboard");
  const skip = new Set(excludeSymbols);
  const rows = (await getLiveInstruments()).filter((r) => r.change_pct != null && r.price != null && !skip.has(r.symbol));
  const toMover = (r: (typeof rows)[number]) => ({
    symbol: r.symbol,
    label: r.instrument.label,
    glyph: r.instrument.glyph,
    tone: r.instrument.tone,
    price: formatPrice(r.price, r.instrument.decimals),
    change: r.change_pct as number,
  });
  const gainers = rows.filter((r) => (r.change_pct as number) > 0).sort((a, b) => (b.change_pct as number) - (a.change_pct as number)).slice(0, PER_TAB).map(toMover);
  const losers = rows.filter((r) => (r.change_pct as number) < 0).sort((a, b) => (a.change_pct as number) - (b.change_pct as number)).slice(0, PER_TAB).map(toMover);
  if (gainers.length === 0 && losers.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-section-title">{t("marketPulseTitle")}</h2>
        <Link href="/discover?tab=markets" className="text-sm text-accent-text hover:underline">
          {t("topMoversAll")}
        </Link>
      </div>
      <MoversTabs gainers={gainers} losers={losers} />
    </section>
  );
}

export type PulseItem = { symbol: string; label: string; glyph: string; tone: string; price: number; decimals: number; change: number };

// The four tiles themselves. The home-page mock-up renders the same grid with fixed values.
export function MarketPulseGrid({ items, wide = false }: { items: PulseItem[]; wide?: boolean }) {
  return (
    <div className={`grid grid-cols-2 gap-2 ${wide ? "sm:grid-cols-3" : "lg:grid-cols-4"}`}>
      {items.map((r) => {
        const pct = r.change;
        return (
          <Link
            key={r.symbol}
            href={`/markets/${r.symbol}`}
            className="flex flex-col gap-2 rounded-2xl border border-border bg-surface px-3 py-3 transition hover:border-accent/40"
          >
            <span className="flex items-center gap-2">
              <InstrumentIcon glyph={r.glyph} toneClass={r.tone} size="h-7 w-7" />
              <span dir="ltr" className="truncate text-sm font-bold">
                {r.label}
              </span>
            </span>
            <span className="flex items-baseline justify-between gap-2">
              <span dir="ltr" className="truncate text-sm tabular-nums">
                {formatPrice(r.price, r.decimals)}
              </span>
              <span dir="ltr" className={`text-xs font-bold tabular-nums ${pct >= 0 ? "text-success" : "text-danger"}`}>
                {pct >= 0 ? "+" : ""}
                {pct.toFixed(2)}%
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
