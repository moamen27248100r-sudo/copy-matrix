function gaugeColor(value: number, invert: boolean) {
  const effective = invert ? 100 - value : value;
  if (effective >= 70) return "var(--success)";
  if (effective >= 40) return "var(--warning)";
  return "var(--danger)";
}

export function CircularGauge({
  value,
  label,
  invert = false,
  size = 84,
}: {
  value: number;
  label: string;
  invert?: boolean;
  size?: number;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const color = gaugeColor(clamped, invert);

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
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-base font-bold">{clamped}</span>
          <span className="text-[10px] text-muted">/100</span>
        </div>
      </div>
      <p className="text-center text-xs text-muted">{label}</p>
    </div>
  );
}
