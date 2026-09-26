import type { ReactElement } from "react";

export type GaugeVariant = "reliability" | "safety" | "risk";
export type GaugeTier = "low" | "medium" | "high";

// Risk reads inverted (a low value is the good outcome) and uses its own
// 25/50 split per the platform's risk-disclosure copy; safety and
// reliability read the normal way, sharing the 40/70 split CircularGauge
// has always used.
export function getGaugeTier(value: number, variant: GaugeVariant): GaugeTier {
  if (variant === "risk") {
    if (value < 25) return "low";
    if (value <= 50) return "medium";
    return "high";
  }
  if (value >= 70) return "high";
  if (value >= 40) return "medium";
  return "low";
}

// One traffic-light scheme (emerald/amber/rose) shared by all three
// gauges — only which tier counts as "good" differs (risk is inverted:
// a low score is the good outcome; safety/reliability the normal way).
const TRAFFIC_LIGHT = {
  good: { text: "text-emerald-400", stroke: "stroke-emerald-500", bg: "bg-emerald-500/10" },
  medium: { text: "text-amber-400", stroke: "stroke-amber-500", bg: "bg-amber-500/10" },
  bad: { text: "text-rose-500", stroke: "stroke-rose-500", bg: "bg-rose-500/10" },
};

const TIER_SEMANTIC: Record<GaugeVariant, Record<GaugeTier, keyof typeof TRAFFIC_LIGHT>> = {
  risk: { low: "good", medium: "medium", high: "bad" },
  safety: { low: "bad", medium: "medium", high: "good" },
  reliability: { low: "bad", medium: "medium", high: "good" },
};

function ShieldAlertIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  );
}

function ShieldCheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9.5 12l1.8 1.8L15 10" />
    </svg>
  );
}

function BadgeCheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2l2.4 1.4 2.8-.2 1.2 2.5 2.5 1.2-.2 2.8L22 12l-1.4 2.4.2 2.8-2.5 1.2-1.2 2.5-2.8-.2L12 22l-2.4-1.4-2.8.2-1.2-2.5-2.5-1.2.2-2.8L2 12l1.4-2.4-.2-2.8 2.5-1.2 1.2-2.5 2.8.2z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

const VARIANT_ICON: Record<GaugeVariant, (props: { className?: string }) => ReactElement> = {
  risk: ShieldAlertIcon,
  safety: ShieldCheckIcon,
  reliability: BadgeCheckIcon,
};

export function CircularGauge({
  value,
  label,
  statusText,
  variant = "reliability",
  size = 96,
}: {
  value: number;
  label: string;
  statusText?: string;
  variant?: GaugeVariant;
  size?: number;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const tier = getGaugeTier(clamped, variant);
  const semantic = TIER_SEMANTIC[variant][tier];
  const { text, stroke: strokeClass, bg } = TRAFFIC_LIGHT[semantic];
  const Icon = VARIANT_ICON[variant];

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} stroke="var(--border)" strokeWidth={stroke} fill="none" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            className={strokeClass}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          <span className={`flex h-9 w-9 items-center justify-center rounded-full ${bg} ${text}`}>
            <Icon className="h-7 w-7" />
          </span>
          <span className={`text-sm font-bold ${text}`}>{clamped}</span>
        </div>
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <p className="text-center text-xs text-muted">{label}</p>
        {statusText && <p className={`text-center text-[11px] font-medium ${text}`}>{statusText}</p>}
      </div>
    </div>
  );
}
