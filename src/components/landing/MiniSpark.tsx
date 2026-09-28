// Mini line chart of cumulative return by month: one stroke, no fill, no glow.
export function MiniSpark({ series, className = "" }: { series: number[]; className?: string }) {
  const pts = [0, ...series];
  if (pts.length < 2) return null;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const w = 120;
  const h = 36;
  const d = pts
    .map((v, i) => `${i === 0 ? "M" : "L"}${((i / (pts.length - 1)) * w).toFixed(1)} ${(h - 2 - ((v - min) / span) * (h - 4)).toFixed(1)}`)
    .join(" ");
  const up = pts[pts.length - 1] >= 0;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} preserveAspectRatio="none" aria-hidden="true" style={{ direction: "ltr" }}>
      <path d={d} fill="none" stroke={up ? "var(--up)" : "var(--down)"} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}


export function pct(v: number, signed = true) {
  const s = Math.abs(v).toFixed(1);
  return `${signed ? (v >= 0 ? "+" : "-") : ""}${s}%`;
}

