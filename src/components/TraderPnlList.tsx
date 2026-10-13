import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getMoney } from "@/lib/money-server";
import { TraderAvatar } from "@/components/TraderAvatar";

export type TraderResultRow = {
  provider_id: string;
  display_name: string | null;
  avatar_url: string | null;
  rating_score: number | null;
  realized: number;
  unrealized: number;
  total: number;
  open_count: number;
};

// Result of each trader the customer copies right now (closed + still open), best first. The
// rows arrive already sorted by the database; the sort here keeps the list right regardless.
export async function TraderPnlList({ rows }: { rows: TraderResultRow[] }) {
  const t = await getTranslations("Dashboard");
  const money = await getMoney();
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => Number(b.total) - Number(a.total));

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">{t("traderResultsTitle")}</h2>
      <div className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface">
        {sorted.map((r) => {
          const total = Number(r.total);
          return (
            <Link
              key={r.provider_id}
              href={`/trader/${r.provider_id}`}
              className="flex min-h-14 items-center gap-3 px-4 py-3 transition hover:bg-white/[0.03]"
            >
              <TraderAvatar providerId={r.provider_id} name={r.display_name ?? ""} avatarUrl={r.avatar_url} ratingScore={r.rating_score} size={36} />
              <div className="min-w-0 flex-1 text-start">
                <p className="truncate text-sm font-medium">{r.display_name}</p>
                <p className="truncate text-xs text-muted">
                  {t("traderResultsSplit", { realized: money(Number(r.realized), { signed: true }), open: money(Number(r.unrealized), { signed: true }) })}
                </p>
              </div>
              <span
                dir="ltr"
                className={`shrink-0 text-sm font-semibold ${total > 0 ? "text-success" : total < 0 ? "text-danger" : "text-foreground"}`}
              >
                {money(total, { signed: true })}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
