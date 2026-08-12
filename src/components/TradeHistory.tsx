"use client";

import { useEffect, useRef, useState } from "react";

type Trade = {
  id: string;
  symbol: string;
  side: string;
  size: number;
  entry: number;
  exit: number | null;
  pnl: number;
  pct: number;
  closedAt: string | null;
  providerName: string;
};

const PERIODS = [
  { key: "today", label: "اليوم" },
  { key: "week", label: "الأسبوع" },
  { key: "month", label: "الشهر" },
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
  return true;
}

export function TradeHistory({ trades }: { trades: Trade[] }) {
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const filtered = trades.filter((t) => withinPeriod(t.closedAt, period));
  const netResult = filtered.reduce((sum, t) => sum + t.pnl, 0);
  const currentLabel = PERIODS.find((p) => p.key === period)!.label;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          {filtered.length} صفقة ·{" "}
          <span className={netResult >= 0 ? "text-success" : "text-danger"} dir="ltr">
            {netResult >= 0 ? "+" : ""}
            {netResult.toFixed(2)}$
          </span>
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
            <div className="absolute left-0 top-full z-10 mt-1 w-32 overflow-hidden rounded border border-border bg-surface shadow-lg">
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
          {filtered.map((t) => (
            <div key={t.id} className="rounded-lg border border-border bg-surface p-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-semibold">{t.symbol}</span>{" "}
                  <span className={t.side === "buy" ? "text-success" : "text-danger"}>
                    {t.side === "buy" ? "شراء" : "بيع"}
                  </span>{" "}
                  <span className="text-muted">{t.size}</span>
                </div>
                <p className={t.pnl >= 0 ? "font-semibold text-success" : "font-semibold text-danger"} dir="ltr">
                  {t.pnl >= 0 ? "+" : ""}
                  {t.pnl.toFixed(2)}$
                </p>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-muted">
                <span dir="ltr">
                  {t.entry.toLocaleString("en-US", { maximumFractionDigits: 4 })}
                  {" → "}
                  {t.exit != null ? t.exit.toLocaleString("en-US", { maximumFractionDigits: 4 }) : "—"}
                </span>
                <span className={t.pct >= 0 ? "text-success" : "text-danger"} dir="ltr">
                  {t.pct >= 0 ? "+" : ""}
                  {t.pct.toFixed(2)}%
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-muted/70">
                <span>{t.providerName}</span>
                <span>
                  {t.closedAt
                    ? new Date(t.closedAt).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" })
                    : "—"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
