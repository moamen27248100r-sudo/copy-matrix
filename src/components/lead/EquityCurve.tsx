"use client";

import { AreaLineChart } from "@/components/charts/AreaLineChart";

type Point = { t: string; v: number };

const fmtPct = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;

// Cumulative-return curve (values are percent).
export function EquityCurve({ points, label }: { points: Point[]; label: string }) {
  if (points.length < 2) return null;
  const pts = points.map((p) => {
    const t = Date.parse(p.t);
    return { v: p.v, t: Number.isNaN(t) ? undefined : t };
  });
  return (
    <div className="rounded-lg border border-border/50 bg-background p-3">
      <AreaLineChart points={pts} format={fmtPct} ariaLabel={label} height={208} />
    </div>
  );
}
