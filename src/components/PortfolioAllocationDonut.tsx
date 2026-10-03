"use client";

import { useMoney } from "@/lib/money-client";

const COLORS = ["var(--accent)", "#34d399", "#f0a020", "#a78bfa", "#f472b6", "#38bdf8"];

export function PortfolioAllocationDonut({
  slices,
  totalLabel,
  totalValue,
}: {
  slices: { label: string; value: number }[];
  totalLabel: string;
  totalValue: number;
}) {
  const money = useMoney();
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) return null;

  const size = 160;
  const strokeWidth = 26;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const visibleSlices = slices.filter((s) => s.value > 0);
  const segments = visibleSlices.map((s, i) => {
    const dash = (s.value / total) * circumference;
    const offset = visibleSlices.slice(0, i).reduce((sum, p) => sum + (p.value / total) * circumference, 0);
    return { ...s, color: COLORS[i % COLORS.length], dash, offset };
  });

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-center sm:gap-8">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90" width={size} height={size}>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth={strokeWidth} />
          {segments.map((seg) => (
            <circle
              key={seg.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${seg.dash} ${circumference - seg.dash}`}
              strokeDashoffset={-seg.offset}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-lg font-bold" dir="ltr">
            {money(totalValue)}
          </p>
          <p className="text-[11px] text-muted">{totalLabel}</p>
        </div>
      </div>

      <div className="flex w-full flex-col gap-2 sm:w-auto">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center justify-between gap-4 text-sm">
            <span className="flex items-center gap-2 text-muted">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: seg.color }} />
              {seg.label}
            </span>
            <span dir="ltr" className="font-medium">
              {money(seg.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
