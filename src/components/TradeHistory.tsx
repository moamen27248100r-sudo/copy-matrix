"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { symbolFullName } from "@/lib/symbol-icons";

type Trade = {
  id: string;
  symbol: string;
  side: string;
  size?: number;
  entry: number;
  exit: number | null;
  pnl?: number | null;
  pct: number;
  openedAt?: string | null;
  closedAt: string | null;
  providerName?: string;
  stopLoss?: number | null;
  takeProfit?: number | null;
  copyHref?: string;
};

const PERIODS = [
  { key: "today", label: "اليوم" },
  { key: "week", label: "الأسبوع" },
  { key: "month", label: "الشهر" },
  { key: "threeMonths", label: "٣ أشهر" },
  { key: "sixMonths", label: "٦ أشهر" },
  { key: "year", label: "سنة" },
  { key: "all", label: "الكل" },
] as const;

type PeriodKey = (typeof PERIODS)[number]["key"];

function withinPeriod(iso: string | null, period: PeriodKey) {
  if (!iso) return false;
  if (period === "all") return true;
  const day = 24 * 60 * 60 * 1000;
  const ts = new Date(iso).getTime();
  if (period === "today") {
    const d = new Date(iso);
    const n = new Date();
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  }
  if (period === "week") return Date.now() - ts <= 7 * day;
  if (period === "month") return Date.now() - ts <= 30 * day;
  if (period === "threeMonths") return Date.now() - ts <= 90 * day;
  if (period === "sixMonths") return Date.now() - ts <= 182 * day;
  if (period === "year") return Date.now() - ts <= 365 * day;
  return true;
}

// A stable, real-looking reference number derived from the trade's own id —
// not a random/fabricated value, just a compact display form of it.
function ticketFromId(id: string): string {
  let hash = 5381;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 33 + id.charCodeAt(i)) >>> 0;
  }
  return String(hash).padStart(9, "0").slice(-9);
}

function formatPreciseDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatPrice(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

export function TradeHistory({ trades }: { trades: Trade[] }) {
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const hasDollar = trades.length > 0 && trades[0].pnl != null;
  const filtered = trades.filter((t) => withinPeriod(t.closedAt, period));
  const netResult = filtered.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
  const wins = filtered.filter((t) => t.pct >= 0).length;
  const winRate = filtered.length > 0 ? Math.round((wins / filtered.length) * 100) : null;
  const currentLabel = PERIODS.find((p) => p.key === period)!.label;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          {filtered.length} صفقة
          {hasDollar ? (
            <>
              {" · "}
              <span className={netResult >= 0 ? "text-success" : "text-danger"} dir="ltr">
                {netResult >= 0 ? "+" : ""}
                {netResult.toFixed(2)}$
              </span>
            </>
          ) : (
            winRate != null && (
              <>
                {" · نسبة النجاح "}
                <span className="text-foreground">{winRate}%</span>
              </>
            )
          )}
        </p>
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 3" />
            </svg>
            {currentLabel}
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {open && (
            <div className="absolute left-0 top-full z-10 mt-1 w-36 overflow-hidden rounded border border-border bg-surface shadow-lg">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => {
                    setPeriod(p.key);
                    setOpen(false);
                  }}
                  className={
                    p.key === period
                      ? "block w-full px-3 py-2 text-right text-sm bg-accent/10 text-accent"
                      : "block w-full px-3 py-2 text-right text-sm text-foreground hover:bg-background"
                  }
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted">لا توجد صفقات مغلقة في هذه الفترة.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((t) => {
            const isExpanded = expandedId === t.id;
            const isProfit = (t.pnl ?? t.pct) >= 0;
            const deltaPoints = t.exit != null ? t.exit - t.entry : null;

            return (
              <div key={t.id} className="overflow-hidden rounded-lg border border-border bg-surface">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : t.id)}
                  aria-expanded={isExpanded}
                  className="flex w-full flex-col gap-1.5 p-3 text-start"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5 text-sm">
                      <span className="font-bold text-foreground" dir="ltr">
                        {t.symbol}
                      </span>
                      <span className={t.side === "buy" ? "font-medium text-accent" : "font-medium text-danger"} dir="ltr">
                        {t.side === "buy" ? "buy" : "sell"}
                        {t.size != null && ` $${t.size}`}
                      </span>
                    </div>
                    <span className={isProfit ? "shrink-0 font-semibold text-success" : "shrink-0 font-semibold text-danger"} dir="ltr">
                      {t.pnl != null
                        ? `${isProfit ? "+" : ""}${t.pnl.toFixed(2)} (${isProfit ? "+" : ""}${t.pct.toFixed(2)}%)`
                        : `${isProfit ? "+" : ""}${t.pct.toFixed(2)}%`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs text-muted">
                    <span dir="ltr">
                      {formatPrice(t.entry)}
                      {" → "}
                      {t.exit != null ? formatPrice(t.exit) : "—"}
                    </span>
                    <span dir="ltr">{formatPreciseDateTime(t.closedAt)}</span>
                  </div>
                </button>

                <div
                  className={
                    isExpanded
                      ? "grid grid-rows-[1fr] transition-[grid-template-rows] duration-300 ease-out"
                      : "grid grid-rows-[0fr] transition-[grid-template-rows] duration-300 ease-out"
                  }
                >
                  <div className="overflow-hidden">
                    <div className="flex flex-col gap-3 border-t border-border px-3 pb-3 pt-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">{symbolFullName(t.symbol)}</p>
                          <p className="text-xs text-muted" dir="ltr">
                            #{ticketFromId(t.id)}
                          </p>
                        </div>
                        {t.providerName && <p className="text-xs text-muted">{t.providerName}</p>}
                      </div>

                      {deltaPoints != null && (
                        <p className={isProfit ? "text-sm font-medium text-success" : "text-sm font-medium text-danger"} dir="ltr">
                          Δ = {deltaPoints >= 0 ? "+" : ""}
                          {formatPrice(deltaPoints)} ({t.pct >= 0 ? "+" : ""}
                          {t.pct.toFixed(2)}%)
                        </p>
                      )}

                      <p className="text-xs text-muted" dir="ltr">
                        {formatPreciseDateTime(t.openedAt)} → {formatPreciseDateTime(t.closedAt)}
                      </p>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center justify-between rounded border border-border/60 px-2 py-1.5">
                          <span className="text-muted">S/L</span>
                          <span dir="ltr">{t.stopLoss != null ? formatPrice(t.stopLoss) : "-"}</span>
                        </div>
                        <div className="flex items-center justify-between rounded border border-border/60 px-2 py-1.5">
                          <span className="text-muted">Swap</span>
                          <span>-</span>
                        </div>
                        <div className="flex items-center justify-between rounded border border-border/60 px-2 py-1.5">
                          <span className="text-muted">T/P</span>
                          <span dir="ltr">{t.takeProfit != null ? formatPrice(t.takeProfit) : "-"}</span>
                        </div>
                        <div className="flex items-center justify-between rounded border border-border/60 px-2 py-1.5">
                          <span className="text-muted">Charges</span>
                          <span>-</span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Link
                          href={`/markets?symbol=${t.symbol}`}
                          className="flex-1 rounded border border-border py-2 text-center text-sm font-medium text-accent transition hover:bg-background"
                        >
                          الشارت
                        </Link>
                        {t.copyHref ? (
                          <Link
                            href={t.copyHref}
                            className="flex-1 rounded border border-border py-2 text-center text-sm font-medium text-accent transition hover:bg-background"
                          >
                            نسخ
                          </Link>
                        ) : (
                          <span className="flex-1 rounded border border-border py-2 text-center text-sm text-muted">—</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
