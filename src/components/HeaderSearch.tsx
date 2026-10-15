"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import { INSTRUMENTS } from "@/lib/markets";
import { InstrumentIcon } from "@/components/markets/MarketsBoard";
import { TraderAvatar } from "@/components/TraderAvatar";

type TraderHit = { id: string; name: string; avatarUrl: string | null; rating: number | null };

// The header search: one field for traders (by name, from /api/search) and markets (by symbol or
// name, from the static list). A field-shaped button on wide screens, an icon on phones; both open
// the same panel. Escape or the close button closes it.
export function HeaderSearch() {
  const t = useTranslations("Nav");
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [traders, setTraders] = useState<TraderHit[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const query = q.trim().toLowerCase();
  const markets = useMemo(
    () =>
      query.length < 1
        ? []
        : INSTRUMENTS.filter((i) => i.symbol.toLowerCase().includes(query.replace("/", "")) || i.label.toLowerCase().includes(query) || i.name.toLowerCase().includes(query)).slice(0, 6),
    [query],
  );

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (query.length < 2) return;
    const ctrl = new AbortController();
    const id = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : { traders: [] }))
        .then((d: { traders: TraderHit[] }) => setTraders(d.traders ?? []))
        .catch(() => {});
    }, 200);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [query]);

  const shownTraders = query.length < 2 ? [] : traders;
  const close = () => {
    setOpen(false);
    setQ("");
    setTraders([]);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("searchPlaceholder")}
        className="tap-44 flex h-9 items-center gap-2 rounded-full border border-border bg-white/[0.03] px-2.5 text-sm text-muted transition hover:border-accent/40 hover:text-foreground lg:w-full lg:max-w-sm lg:px-4"
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="hidden truncate lg:inline">{t("searchPlaceholder")}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[10050] flex items-start justify-center bg-black/60 p-4 pt-16 backdrop-blur-sm" onClick={close}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("searchPlaceholder")}
            className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-[20px] border border-border bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("searchPlaceholder")}
                aria-label={t("searchPlaceholder")}
                className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-dim"
              />
              <button type="button" onClick={close} aria-label={t("searchClose")} className="tap-44 rounded-full p-1 text-muted hover:text-foreground">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex flex-col gap-4 overflow-y-auto p-3">
              {shownTraders.length > 0 && (
                <section>
                  <h2 className="px-2 pb-1 text-xs font-bold text-muted">{t("searchTraders")}</h2>
                  <ul>
                    {shownTraders.map((tr) => (
                      <li key={tr.id}>
                        <Link href={`/trader/${tr.id}`} onClick={close} className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-white/5">
                          <TraderAvatar providerId={tr.id} name={tr.name} avatarUrl={tr.avatarUrl} ratingScore={tr.rating} size={32} />
                          <span className="min-w-0 truncate text-sm font-bold">{tr.name}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {markets.length > 0 && (
                <section>
                  <h2 className="px-2 pb-1 text-xs font-bold text-muted">{t("searchMarkets")}</h2>
                  <ul>
                    {markets.map((m) => (
                      <li key={m.symbol}>
                        <Link href={`/markets/${m.symbol}`} onClick={close} className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-white/5">
                          <InstrumentIcon glyph={m.glyph} toneClass={m.tone} size="h-8 w-8" />
                          <span className="min-w-0">
                            <span dir="ltr" className="block truncate text-sm font-bold">
                              {m.label}
                            </span>
                            <span className="block truncate text-xs text-muted">{m.name}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {query.length > 0 && shownTraders.length === 0 && markets.length === 0 && (
                <p className="px-2 py-6 text-center text-sm text-muted">{t("searchEmpty")}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
