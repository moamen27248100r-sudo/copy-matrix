import Link from "next/link";
import { Star } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { Sparkline } from "@/components/Sparkline";
import { INSTRUMENTS, formatPrice, instrumentBySymbol, parseSnapshot, type SnapshotRow } from "@/lib/markets";
import { toggleWatch } from "@/app/markets/actions";

const pct = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`);
const tone = (v: number | null) => (v == null ? "text-muted" : v >= 0 ? "text-success" : "text-danger");

function Row({ row, starred, label }: { row: SnapshotRow; starred: boolean; label: { watch: string; unwatch: string } }) {
  const inst = instrumentBySymbol(row.symbol);
  if (!inst) return null;
  const spark = row.spark && row.spark.length >= 3 && row.spark[0] > 0 ? row.spark.map((p) => (p / (row.spark as number[])[0] - 1) * 100) : null;
  return (
    <li className="flex items-center gap-2 rounded-2xl border border-border bg-surface pe-2 transition hover:border-accent/40">
      <Link href={`/markets/${row.symbol}`} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3">
        <span className="w-24 shrink-0 text-sm font-semibold" dir="ltr">
          {inst.label}
        </span>
        <span className="min-w-0 flex-1">{spark && <Sparkline values={spark} className="h-9 w-full" />}</span>
        <span className="shrink-0 text-end">
          <span dir="ltr" className="block text-sm tabular-nums">
            {formatPrice(row.price, inst.decimals)}
          </span>
          <span dir="ltr" className={`block text-xs font-semibold tabular-nums ${tone(row.change_pct)}`}>
            {pct(row.change_pct)}
          </span>
        </span>
      </Link>
      <form action={toggleWatch}>
        <input type="hidden" name="symbol" value={row.symbol} />
        <input type="hidden" name="returnTo" value="/discover?tab=markets" />
        <button
          type="submit"
          aria-label={starred ? label.unwatch : label.watch}
          aria-pressed={starred}
          title={starred ? label.unwatch : label.watch}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-muted transition hover:bg-white/5 hover:text-warning"
        >
          <Star className={`h-5 w-5 ${starred ? "fill-warning text-warning" : ""}`} aria-hidden="true" />
        </button>
      </form>
    </li>
  );
}

// The Markets view: the biggest risers and fallers of the day, then every instrument we quote with
// its live price, the 24-hour change and a small chart; the star adds it to the watchlist, which
// comes first. The numbers come from the platform's own price history (market_snapshot).
export async function MarketsTab({ userId }: { userId: string }) {
  const t = await getTranslations("Markets");
  const supabase = await createClient();
  const [{ data: snap }, { data: watch }] = await Promise.all([
    supabase.rpc("market_snapshot"),
    supabase.from("market_watchlist").select("symbol").eq("user_id", userId),
  ]);
  const rows = parseSnapshot(snap);
  const starred = new Set((watch ?? []).map((w) => w.symbol as string));
  const byChange = [...rows].filter((r) => r.change_pct != null).sort((a, b) => (b.change_pct as number) - (a.change_pct as number));
  const risers = byChange.filter((r) => (r.change_pct as number) > 0).slice(0, 3);
  const fallers = [...byChange].reverse().filter((r) => (r.change_pct as number) < 0).slice(0, 3);
  const order = new Map(INSTRUMENTS.map((i, idx) => [i.symbol, idx]));
  const list = [...rows].sort((a, b) => Number(starred.has(b.symbol)) - Number(starred.has(a.symbol)) || (order.get(a.symbol) ?? 0) - (order.get(b.symbol) ?? 0));
  const label = { watch: t("watch"), unwatch: t("unwatch") };

  const movers = (title: string, items: SnapshotRow[]) =>
    items.length > 0 && (
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted">{title}</h2>
        <div className="flex flex-col gap-2">
          {items.map((r) => {
            const inst = instrumentBySymbol(r.symbol);
            return (
              <Link
                key={r.symbol}
                href={`/markets/${r.symbol}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3 transition hover:border-accent/40"
              >
                <span dir="ltr" className="text-sm font-semibold">
                  {inst?.label ?? r.symbol}
                </span>
                <span dir="ltr" className={`text-sm font-semibold tabular-nums ${tone(r.change_pct)}`}>
                  {pct(r.change_pct)}
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    );

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted">{t("subtitle")}</p>
      {(risers.length > 0 || fallers.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {movers(t("topRisers"), risers)}
          {movers(t("topFallers"), fallers)}
        </div>
      )}
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">{t("allInstruments")}</h2>
        {list.length === 0 ? (
          <p className="text-sm text-muted">{t("noData")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {list.map((row) => (
              <Row key={row.symbol} row={row} starred={starred.has(row.symbol)} label={label} />
            ))}
          </ul>
        )}
      </section>
      <p className="text-[11px] text-muted">{t("dataNote")}</p>
    </div>
  );
}
