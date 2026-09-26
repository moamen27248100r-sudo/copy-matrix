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

const TIER_COLOR: Record<GaugeVariant, Record<GaugeTier, string>> = {
  risk: { low: "var(--success)", medium: "var(--warning)", high: "var(--danger)" },
  safety: { low: "var(--danger)", medium: "var(--warning)", high: "var(--success)" },
  // Reliability's top tier is the platform's financial blue (--accent)
  // rather than green, so it reads distinctly from "safety" at a glance.
  reliability: { low: "var(--danger)", medium: "var(--warning)", high: "var(--accent)" },
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
  size = 84,
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
  const color = TIER_COLOR[variant][tier];
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
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <Icon className="h-3.5 w-3.5" />
          <span style={{ color }} className="text-base font-bold">
            {clamped}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <p className="text-center text-xs text-muted">{label}</p>
        {statusText && (
          <p style={{ color }} className="text-center text-[11px] font-medium">
            {statusText}
          </p>
        )}
      </div>
    </div>
  );
}
