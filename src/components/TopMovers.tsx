import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { formatPrice, instrumentBySymbol, parseSnapshot } from "@/lib/markets";

// "Most moved today" on the home page: the three instruments whose price changed most over the last
// 24 hours (market_snapshot, from the platform's own price history); each opens its page.
export async function TopMovers() {
  const t = await getTranslations("Dashboard");
  const supabase = await createClient();
  const { data } = await supabase.rpc("market_snapshot");

  const rows = parseSnapshot(data)
    .filter((r) => r.change_pct != null && instrumentBySymbol(r.symbol))
    .sort((a, b) => Math.abs(b.change_pct as number) - Math.abs(a.change_pct as number))
    .slice(0, 3);

  if (rows.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">{t("topMoversTitle")}</h2>
        <Link href="/discover?tab=markets" className="text-sm text-accent hover:underline">
          {t("topMoversAll")}
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {rows.map((r) => {
          const inst = instrumentBySymbol(r.symbol)!;
          const pct = r.change_pct as number;
          return (
            <Link
              key={r.symbol}
              href={`/markets/${r.symbol}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3 transition hover:border-accent/40"
            >
              <span dir="ltr" className="text-sm font-semibold">
                {inst.label}
              </span>
              <span className="text-end">
                <span dir="ltr" className="block text-sm tabular-nums">
                  {formatPrice(r.price, inst.decimals)}
                </span>
                <span dir="ltr" className={`block text-xs font-semibold tabular-nums ${pct >= 0 ? "text-success" : "text-danger"}`}>
                  {pct >= 0 ? "+" : ""}
                  {pct.toFixed(2)}%
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
