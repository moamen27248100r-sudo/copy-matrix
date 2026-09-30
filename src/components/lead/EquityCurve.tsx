type Point = { t: string; v: number };

// Cumulative-return curve as plain SVG (server-rendered, no client JS).
// Values are percent; a dashed baseline marks 0.
export function EquityCurve({ points, label }: { points: Point[]; label: string }) {
  if (points.length < 2) return null;
  const W = 600;
  const H = 200;
  const pad = 6;
  const vals = points.map((p) => p.v);
  const min = Math.min(0, ...vals);
  const max = Math.max(0, ...vals);
  const span = max - min || 1;
  const x = (i: number) => pad + (i / (points.length - 1)) * (W - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / span) * (H - pad * 2);
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
  const up = points[points.length - 1].v >= 0;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="h-48 w-full sm:h-56" preserveAspectRatio="none" style={{ direction: "ltr" }}>
      <line x1={pad} x2={W - pad} y1={y(0)} y2={y(0)} stroke="currentColor" strokeOpacity={0.25} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
      <path d={`${line} L${x(points.length - 1)} ${y(0)} L${x(0)} ${y(0)} Z`} className={up ? "fill-success/10" : "fill-danger/10"} />
      <path d={line} fill="none" strokeWidth={2} vectorEffect="non-scaling-stroke" className={up ? "stroke-success" : "stroke-danger"} />
    </svg>
  );
}
