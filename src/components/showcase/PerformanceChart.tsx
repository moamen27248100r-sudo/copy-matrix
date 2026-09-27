"use client";

import { useEffect, useRef, useState } from "react";

const WIDTH = 240;
const HEIGHT = 80;

// A line chart that draws itself in (stroke-dashoffset from full length
// to 0) the moment its screen becomes active, via a plain CSS
// transition -- no animation library, transform/opacity-equivalent
// (stroke-dashoffset is cheap to animate and doesn't affect layout).
export function PerformanceChart({
  points,
  color,
  active,
  reducedMotion,
}: {
  points: number[];
  color: string;
  active: boolean;
  reducedMotion: boolean;
}) {
  const pathRef = useRef<SVGPolylineElement>(null);
  const [length, setLength] = useState(0);

  useEffect(() => {
    if (pathRef.current) setLength(pathRef.current.getTotalLength());
  }, []);

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const stepX = WIDTH / (points.length - 1);
  const y = (v: number) => HEIGHT - ((v - min) / range) * (HEIGHT - 8) - 4;
  const coords = points.map((v, i) => `${i * stepX},${y(v)}`).join(" ");
  const areaPoints = `0,${HEIGHT} ${coords} ${WIDTH},${HEIGHT}`;
  const gradId = `showcase-chart-fill-${color.replace("#", "")}`;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-full w-full" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#${gradId})`} />
      <polyline
        ref={pathRef}
        points={coords}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={
          reducedMotion || length === 0
            ? undefined
            : {
                strokeDasharray: length,
                strokeDashoffset: active ? 0 : length,
                transition: "stroke-dashoffset 1200ms ease-out",
              }
        }
      />
    </svg>
  );
}
