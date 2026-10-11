"use client";

// Mini equity curve for cards: the shared area-line chart in its compact form
// (no axes). `values` is the cumulative return series in percent.

import { AreaLineChart } from "@/components/charts/AreaLineChart";
import { fmtReturn } from "@/lib/format-stats";


export function Sparkline({ values, className = "" }: { values: number[]; className?: string }) {
  if (values.length < 3) return <div className={className} aria-hidden="true" />;
  return (
    <AreaLineChart
      compact
      mode="static"
      height={64}
      points={values.map((v) => ({ v }))}
      format={fmtReturn}
      ariaLabel="Return"
      className={className}
    />
  );
}
