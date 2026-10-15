import Link from "next/link";
import { getMoney } from "@/lib/money-server";
import { TraderAvatar } from "@/components/TraderAvatar";

export type CopySummaryItem = {
  id: string;
  providerId: string;
  name: string;
  avatarUrl: string | null;
  rating: number | null;
  allocated: number;
  total: number;
};

// The home page's "traders you copy" rows: who, how much is put in, and the result so far. The
// home-page mock-up renders the same rows with fixed values.
export async function CopySummaryList({ items }: { items: CopySummaryItem[] }) {
  const money = await getMoney();
  return (
    <div className="flex flex-col gap-2">
      {items.map((c) => (
        <Link
          key={c.id}
          href="/copies"
          className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 transition hover:border-accent/40"
        >
          <TraderAvatar providerId={c.providerId} name={c.name} avatarUrl={c.avatarUrl} ratingScore={c.rating} size={40} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{c.name}</span>
            <span className="block text-xs text-muted" dir="ltr">
              {money(c.allocated)}
            </span>
          </span>
          <span dir="ltr" className={`shrink-0 text-sm font-bold tabular-nums ${c.total >= 0 ? "text-success" : "text-danger"}`}>
            {money(c.total, { signed: true })}
          </span>
        </Link>
      ))}
    </div>
  );
}
