"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Search, Star } from "lucide-react";
import { Sparkline } from "@/components/Sparkline";
import { formatPrice, type InstrumentKind } from "@/lib/markets";
import { useMarketFeed, type FeedQuote } from "@/lib/use-market-feed";
import { setWatch } from "@/app/markets/actions";

export type BoardRow = {
  symbol: string;
  label: string;
  name: string;
  kind: InstrumentKind;
  decimals: number;
  glyph: string;
  tone: string;
  daily: boolean;
  price: number;
  change: number | null;
  high: number | null;
  low: number | null;
  spark: number[] | null;
  volume: number | null;
};

const pct = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`);
const tone = (v: number | null) => (v == null ? "text-muted" : v >= 0 ? "text-success" : "text-danger");

export function InstrumentIcon({ glyph, toneClass, size = "h-9 w-9" }: { glyph: string; toneClass: string; size?: string }) {
  return (
    <span aria-hidden="true" className={`flex ${size} shrink-0 items-center justify-center rounded-full text-sm font-bold ${toneClass}`}>
      {glyph}
    </span>
  );
}

const compactVolume = (v: number) => (v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v).toLocaleString("en-US")}`);

// The Markets view: top risers / fallers / most traded, tabs per market, search, and one row per
// instrument with its live price (a soft green / red flash when it changes), the day change, a small
// chart and the watchlist star. Prices refresh through one batched request while the page is visible.
export function MarketsBoard({ rows, watched: initialWatched }: { rows: BoardRow[]; watched: string[] }) {
  const t = useTranslations("Markets");
  const { quotes, flash } = useMarketFeed(Object.fromEntries(rows.map((r) => [r.symbol, { p: r.price, c: r.change, h: r.high, l: r.low } satisfies FeedQuote])));
  const [tab, setTab] = useState<"all" | InstrumentKind>("all");
  const [query, setQuery] = useState("");
  const [watched, setWatched] = useState(() => new Set(initialWatched));
  const [, startTransition] = useTransition();

  const live = useMemo(
    () =>
      rows.map((r) => {
        const q = quotes[r.symbol];
        return { ...r, price: q?.p ?? r.price, change: q ? q.c : r.change };
      }),
    [rows, quotes],
  );

  const tabs = useMemo(() => {
    const kinds = (["crypto", "forex", "commodity"] as InstrumentKind[]).filter((k) => rows.some((r) => r.kind === k));
    return [{ key: "all" as const }, ...kinds.map((k) => ({ key: k }))];
  }, [rows]);
  const tabLabel = (k: string) => t(`tab_${k}`);

  const byChange = [...live].filter((r) => r.change != null).sort((a, b) => (b.change as number) - (a.change as number));
  const risers = byChange.filter((r) => (r.change as number) > 0).slice(0, 3);
  const fallers = [...byChange].reverse().filter((r) => (r.change as number) < 0).slice(0, 3);
  const traded = [...live].filter((r) => r.volume != null).sort((a, b) => (b.volume as number) - (a.volume as number)).slice(0, 3);

  const q = query.trim().toLowerCase();
  const list = live
    .filter((r) => tab === "all" || r.kind === tab)
    .filter((r) => !q || r.name.toLowerCase().includes(q) || r.label.toLowerCase().includes(q) || r.symbol.toLowerCase().includes(q))
    .sort((a, b) => Number(watched.has(b.symbol)) - Number(watched.has(a.symbol)));

  function toggle(symbol: string) {
    const on = !watched.has(symbol);
    setWatched((cur) => {
      const next = new Set(cur);
      if (on) next.add(symbol);
      else next.delete(symbol);
      return next;
    });
    startTransition(async () => {
      const res = await setWatch(symbol, on);
      if (!res.ok) {
        // undo the optimistic change
        setWatched((cur) => {
          const next = new Set(cur);
          if (on) next.delete(symbol);
          else next.add(symbol);
          return next;
        });
      }
    });
  }

  const miniList = (title: string, items: typeof live, value: (r: (typeof live)[number]) => { text: string; cls: string }) =>
    items.length > 0 && (
      <section className="flex min-w-0 flex-col gap-2 rounded-2xl border border-border bg-surface p-3">
        <h2 className="text-xs font-semibold text-muted">{title}</h2>
        <ul className="flex flex-col gap-1">
          {items.map((r) => {
            const v = value(r);
            return (
              <li key={r.symbol}>
                <Link href={`/markets/${r.symbol}`} className="flex items-center justify-between gap-2 rounded-lg px-1.5 py-1.5 transition hover:bg-white/5">
                  <span className="flex min-w-0 items-center gap-2">
                    <InstrumentIcon glyph={r.glyph} toneClass={r.tone} size="h-6 w-6" />
                    <span dir="ltr" className="truncate text-sm font-medium">
                      {r.label}
                    </span>
                  </span>
                  <span dir="ltr" className={`shrink-0 text-sm font-semibold tabular-nums ${v.cls}`}>
                    {v.text}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    );

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {miniList(t("topRisers"), risers, (r) => ({ text: pct(r.change), cls: "text-success" }))}
        {miniList(t("topFallers"), fallers, (r) => ({ text: pct(r.change), cls: "text-danger" }))}
        {miniList(t("mostTraded"), traded, (r) => ({ text: compactVolume(r.volume as number), cls: "text-foreground" }))}
      </div>

      <div className="flex flex-col gap-3">
        {tabs.length > 2 && (
          <div className="flex gap-1.5 overflow-x-auto rounded-lg border border-border bg-surface p-1" role="tablist">
            {tabs.map(({ key }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`tap-44 shrink-0 flex-1 rounded px-3 py-2 text-sm transition ${tab === key ? "bg-accent font-medium text-accent-foreground" : "text-muted hover:text-foreground"}`}
              >
                {tabLabel(key)}
              </button>
            ))}
          </div>
        )}
        <label className="relative block">
          <span className="sr-only">{t("searchLabel")}</span>
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full rounded-full border border-white/[0.08] bg-surface/80 py-2 ps-9 pe-3 text-base text-foreground placeholder:text-muted focus:border-accent/40 focus:outline-none"
          />
        </label>
      </div>

      {list.length === 0 ? (
        <p className="rounded-2xl border border-border bg-surface p-5 text-sm text-muted">{query ? t("noResults") : t("noData")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((r) => {
            const f = flash[r.symbol];
            const starred = watched.has(r.symbol);
            const spark = r.spark && r.spark.length >= 3 && r.spark[0] > 0 ? r.spark.map((p) => (p / (r.spark as number[])[0] - 1) * 100) : null;
            return (
              <li key={r.symbol} className="flex items-center gap-1 rounded-2xl border border-border bg-surface pe-1.5 transition hover:border-accent/40">
                <Link href={`/markets/${r.symbol}`} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3">
                  <InstrumentIcon glyph={r.glyph} toneClass={r.tone} />
                  <span className="w-28 shrink-0">
                    <span className="block truncate text-sm font-semibold">{r.name}</span>
                    <span dir="ltr" className="block truncate text-xs text-muted">
                      {r.label}
                    </span>
                  </span>
                  <span className="hidden min-w-0 flex-1 sm:block">{spark && <Sparkline values={spark} className="h-9 w-full" />}</span>
                  <span className="ms-auto shrink-0 text-end">
                    <span
                      dir="ltr"
                      className={`inline-block rounded px-1 text-sm tabular-nums transition-colors duration-500 ${f === "up" ? "bg-success/25" : f === "down" ? "bg-danger/25" : "bg-transparent"}`}
                    >
                      {formatPrice(r.price, r.decimals)}
                    </span>
                    <span dir="ltr" className={`block text-xs font-semibold tabular-nums ${tone(r.change)}`}>
                      {r.daily ? <span className="me-1 font-normal text-muted">{t("daily")}</span> : null}
                      {pct(r.change)}
                    </span>
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => toggle(r.symbol)}
                  aria-pressed={starred}
                  aria-label={starred ? t("unwatch") : t("watch")}
                  title={starred ? t("unwatch") : t("watch")}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-white/5 hover:text-warning"
                >
                  <Star className={`h-5 w-5 ${starred ? "fill-warning text-warning" : ""}`} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-[11px] text-muted">{t("dataNote")}</p>
    </div>
  );
}
