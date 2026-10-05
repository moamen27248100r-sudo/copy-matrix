import type { DailySeries } from "@/components/TraderEquityChart";

// A colored heatmap of the trader's last 12 months of return -- each cell is
// that month's time-weighted return on equity (the daily returns compounded),
// shaded green or red by magnitude so a follower can spot a leader's good and
// bad months at a glance.
export function MonthlyReturnsCalendar({ daily, locale }: { daily: DailySeries | null; locale: string }) {
  const now = new Date();
  const months: { key: string; label: string; year: number; month: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push({
      key: `${d.getUTCFullYear()}-${d.getUTCMonth()}`,
      label: d.toLocaleDateString(locale, { month: "short", timeZone: "UTC" }),
      year: d.getUTCFullYear(),
      month: d.getUTCMonth(),
    });
  }

  const indexByMonth = new Map<string, number>();
  (daily?.days ?? []).forEach((day, i) => {
    const d = new Date(day + "T00:00:00Z");
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    indexByMonth.set(key, (indexByMonth.get(key) ?? 1) * (1 + Number(daily!.ret[i] ?? 0)));
  });
  const returnByMonth = new Map(Array.from(indexByMonth.entries()).map(([k, v]) => [k, (v - 1) * 100]));

  const maxAbs = Math.max(1, ...Array.from(returnByMonth.values()).map((v) => Math.abs(v)));

  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
      {months.map((m) => {
        const value = returnByMonth.get(m.key);
        const intensity = value != null ? Math.min(1, Math.abs(value) / maxAbs) : 0;
        const bg =
          value == null
            ? "bg-white/[0.03] border-white/[0.06]"
            : value >= 0
              ? `border-success/30`
              : `border-danger/30`;
        return (
          <div
            key={m.key}
            className={`flex flex-col items-center gap-1 rounded-xl border p-2.5 text-center ${bg}`}
            style={
              value != null
                ? { backgroundColor: value >= 0 ? `rgba(14,203,129,${0.08 + intensity * 0.3})` : `rgba(246,70,93,${0.08 + intensity * 0.3})` }
                : undefined
            }
          >
            <span className="text-[11px] text-muted">{m.label}</span>
            <span className={`text-xs font-semibold ${value == null ? "text-muted" : value >= 0 ? "text-success" : "text-danger"}`} dir="ltr">
              {value != null ? `${value > 0 ? "+" : ""}${value.toFixed(1)}%` : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
