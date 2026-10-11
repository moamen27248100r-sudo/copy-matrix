"use client";

// Mini equity curve for cards: the shared area-line chart in its compact form
// (no axes). `values` is the cumulative return series in percent.

import { AreaLineChart } from "@/components/charts/AreaLineChart";

const fmtPct = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;

export function Sparkline({ values, className = "" }: { values: number[]; className?: string }) {
  if (values.length < 3) return <div className={className} aria-hidden="true" />;
  return (
    <AreaLineChart
      compact
      mode="static"
      height={64}
      points={values.map((v) => ({ v }))}
      format={fmtPct}
      ariaLabel="Return"
      className={className}
    />
  );
}
