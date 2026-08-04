"use client";

import { useMemo, useState } from "react";

type SignalRow = {
  id: string;
  symbol: string;
  side: string;
  entry_price: number;
  exit_price: number | null;
  status: string;
  opened_at: string;
  closed_at: string | null;
};

const PERIODS: { label: string; days: number | null }[] = [
  { label: "أسبوع", days: 7 },
  { label: "شهر", days: 30 },
  { label: "٣ أشهر", days: 90 },
  { label: "سنة", days: 365 },
  { label: "الكل", days: null },
];

export function TraderEquityChart({ signals }: { signals: SignalRow[] }) {
  const [periodIdx, setPeriodIdx] = useState(1);

  const points = useMemo(() => {
    const period = PERIODS[periodIdx];
    const cutoff = period.days != null ? Date.now() - period.days * 24 * 60 * 60 * 1000 : 0;
    const closed = signals
      .filter(
        (s) =>
          s.status === "closed" &&
          s.closed_at &&
          s.exit_price != null &&
          new Date(s.closed_at).getTime() >= cutoff,
      )
      .sort((a, b) => new Date(a.closed_at!).getTime() - new Date(b.closed_at!).getTime());

    let cumulative = 0;
    const pts = [0];
    for (const s of closed) {
      const raw = (s.exit_price! - s.entry_price) / s.entry_price;
      const signed = s.side === "sell" ? -raw : raw;
      cumulative += signed * 100;
      pts.push(cumulative);
    }
    return pts;
  }, [signals, periodIdx]);

  const width = 600;
  const height = 180;
  const hasData = points.length >= 3;
  const min = Math.min(...points, 0);
  const max = Math.max(...points, 0);
  const range = max - min || 1;
  const stepX = hasData ? width / (points.length - 1) : 0;
  const coords = points.map((v, i) => `${i * stepX},${height - ((v - min) / range) * height}`).join(" ");
  const zeroY = height - ((0 - min) / range) * height;
  const last = points[points.length - 1] ?? 0;
  const isPositive = last >= 0;
  const color = isPositive ? "var(--success)" : "var(--danger)";
  const areaPoints = hasData ? `0,${height} ${coords} ${width},${height}` : "";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5">
        {PERIODS.map((p, i) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setPeriodIdx(i)}
            className={
              i === periodIdx
                ? "rounded border border-brand bg-brand/10 px-3 py-1 text-xs text-brand"
                : "rounded border border-border px-3 py-1 text-xs text-muted"
            }
          >
            {p.label}
          </button>
        ))}
      </div>

      {!hasData ? (
        <p className="text-sm text-muted">لا توجد صفقات مغلقة كافية في هذه الفترة لعرض الرسم البياني.</p>
      ) : (
        <div className="rounded-lg border border-border bg-background p-3">
          <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full">
            <defs>
              <linearGradient id="equity-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0.25, 0.5, 0.75].map((f) => (
              <line
                key={f}
                x1={0}
                y1={height * f}
                x2={width}
                y2={height * f}
                stroke="var(--border)"
                strokeWidth={0.5}
              />
            ))}
            <line x1={0} y1={zeroY} x2={width} y2={zeroY} stroke="var(--border)" strokeDasharray="4" />
            <polygon points={areaPoints} fill="url(#equity-fill)" />
            <polyline
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              points={coords}
            />
          </svg>
          <div className="flex items-center justify-between text-xs text-muted">
            <span>البداية: 0%</span>
            <span className={isPositive ? "text-success" : "text-danger"}>
              الحالي: {last > 0 ? "+" : ""}
              {last.toFixed(2)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
