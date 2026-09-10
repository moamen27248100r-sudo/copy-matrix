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

type ChartPoint = { value: number; date: string | null };

export function TraderEquityChart({ signals }: { signals: SignalRow[] }) {
  const [periodIdx, setPeriodIdx] = useState(1);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const points = useMemo<ChartPoint[]>(() => {
    const period = PERIODS[periodIdx];
    // Rounded to the start of the current UTC day, not the exact millisecond:
    // Date.now() computed fresh on both the server's SSR pass and the client's
    // hydration pass can differ by however long the request took, which can
    // flip whether a trade sitting right at the period boundary is included --
    // a real (if narrow) hydration mismatch. Day-granularity makes that
    // practically impossible without changing what "last 30 days" means.
    const now = new Date();
    const todayUtcStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const cutoff = period.days != null ? todayUtcStart - period.days * 24 * 60 * 60 * 1000 : 0;
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
    const pts: ChartPoint[] = [{ value: 0, date: null }];
    for (const s of closed) {
      const raw = (s.exit_price! - s.entry_price) / s.entry_price;
      const signed = s.side === "sell" ? -raw : raw;
      cumulative += signed * 100;
      pts.push({ value: cumulative, date: s.closed_at });
    }
    return pts;
  }, [signals, periodIdx]);

  const width = 600;
  const height = 180;
  const hasData = points.length >= 3;
  const values = points.map((p) => p.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = max - min || 1;
  const stepX = hasData ? width / (points.length - 1) : 0;
  const yFor = (v: number) => height - ((v - min) / range) * height;
  const coords = points.map((p, i) => `${i * stepX},${yFor(p.value)}`).join(" ");
  const zeroY = yFor(0);
  const last = values[values.length - 1] ?? 0;
  const color = "var(--brand)";
  const areaPoints = hasData ? `0,${height} ${coords} ${width},${height}` : "";
  const hovered = hoverIdx != null ? points[hoverIdx] : null;

  const handlePointer = (clientX: number, svgEl: SVGSVGElement) => {
    if (!hasData) return;
    const rect = svgEl.getBoundingClientRect();
    const relX = ((clientX - rect.left) / rect.width) * width;
    const idx = Math.max(0, Math.min(points.length - 1, Math.round(relX / stepX)));
    setHoverIdx(idx);
  };

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
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-44 w-full touch-none"
            onMouseMove={(e) => handlePointer(e.clientX, e.currentTarget)}
            onMouseLeave={() => setHoverIdx(null)}
            onTouchMove={(e) => {
              const touch = e.touches[0];
              if (touch) handlePointer(touch.clientX, e.currentTarget);
            }}
            onTouchEnd={() => setHoverIdx(null)}
          >
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
            {hoverIdx != null && hovered && (
              <>
                <line
                  x1={hoverIdx * stepX}
                  y1={0}
                  x2={hoverIdx * stepX}
                  y2={height}
                  stroke="var(--border)"
                  strokeWidth={1}
                />
                <circle cx={hoverIdx * stepX} cy={yFor(hovered.value)} r={4} fill={color} stroke="var(--background)" strokeWidth={1.5} />
                {(() => {
                  const boxWidth = 108;
                  const boxHeight = 36;
                  const px = Math.min(Math.max(hoverIdx * stepX - boxWidth / 2, 2), width - boxWidth - 2);
                  const py = yFor(hovered.value) > height / 2 ? yFor(hovered.value) - boxHeight - 10 : yFor(hovered.value) + 10;
                  return (
                    <g pointerEvents="none">
                      <rect x={px} y={py} width={boxWidth} height={boxHeight} rx={6} fill="var(--surface)" stroke="var(--border)" strokeWidth={1} />
                      <text x={px + boxWidth / 2} y={py + 15} textAnchor="middle" fontSize="10" fill="var(--muted)">
                        {hovered.date
                          ? new Date(hovered.date).toLocaleDateString("ar-EG", { day: "numeric", month: "short" })
                          : "البداية"}
                      </text>
                      <text x={px + boxWidth / 2} y={py + 28} textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--foreground)">
                        {hovered.value > 0 ? "+" : ""}
                        {hovered.value.toFixed(2)}%
                      </text>
                    </g>
                  );
                })()}
              </>
            )}
          </svg>
          <div className="flex items-center justify-between text-xs text-muted">
            <span>البداية: 0%</span>
            <span className="text-foreground">
              الحالي: {last > 0 ? "+" : ""}
              {last.toFixed(2)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
