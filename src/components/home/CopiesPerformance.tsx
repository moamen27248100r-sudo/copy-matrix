import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getMoney } from "@/lib/money-server";
import { TraderAvatar } from "@/components/TraderAvatar";

export type CopyPerformanceRow = {
  providerId: string;
  name: string;
  avatarUrl: string | null;
  rating: number | null;
  invested: number;
  /** realized + unrealized */
  result: number;
  openCount: number;
};

// How each copy is doing: the trader, what is invested, the result so far (closed + open trades)
// and how many trades are open now. One row per copied trader.
export async function CopiesPerformance({ rows }: { rows: CopyPerformanceRow[] }) {
  if (rows.length === 0) return null;
  const t = await getTranslations("Dashboard");
  const tNav = await getTranslations("Nav");
  const money = await getMoney();
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-section-title">{t("copiesPerfTitle")}</h2>
        <Link href="/copies" className="text-sm text-accent-text hover:underline">
          {tNav("viewAll")}
        </Link>
      </div>
      <ul className="flex flex-col divide-y divide-border rounded-[20px] border border-border bg-surface">
        {rows.map((r) => {
          const pct = r.invested > 0 ? (r.result / r.invested) * 100 : 0;
          const tone = r.result > 0 ? "text-success" : r.result < 0 ? "text-danger" : "text-foreground";
          return (
            <li key={r.providerId}>
              <Link href={`/trader/${r.providerId}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.03]">
                <TraderAvatar providerId={r.providerId} name={r.name} avatarUrl={r.avatarUrl} ratingScore={r.rating} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{r.name}</span>
                  <span className="block text-xs text-muted">
                    {t("copiesPerfInvested")} <bdi dir="ltr">{money(r.invested)}</bdi> · {t("openTradesCount", { count: r.openCount })}
                  </span>
                </span>
                <span className="shrink-0 text-end">
                  <span className={`block text-sm font-bold tabular-nums ${tone}`}>
                    <bdi dir="ltr">{money(r.result, { signed: r.result !== 0 })}</bdi>
                  </span>
                  <span className={`block text-xs tabular-nums ${tone}`}>
                    <bdi dir="ltr">
                      {pct > 0 ? "+" : ""}
                      {pct.toFixed(2)}%
                    </bdi>
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
