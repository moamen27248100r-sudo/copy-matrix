type SignalRow = {
  side: string;
  entry_price: number;
  exit_price: number | null;
  status: string;
  closed_at: string | null;
};

// A colored heatmap of the trader's last 12 months of realized return --
// each cell is the sum of that month's closed trades' % return (same
// per-trade convention TraderEquityChart/periodStats use), shaded green
// or red by magnitude so a follower can spot a leader's good/bad months
// at a glance instead of reading the raw performance grid.
export function MonthlyReturnsCalendar({ signals, locale }: { signals: SignalRow[]; locale: string }) {
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

  const returnByMonth = new Map<string, number>();
  for (const s of signals) {
    if (s.status !== "closed" || s.exit_price == null || !s.closed_at) continue;
    const d = new Date(s.closed_at);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    const raw = (s.exit_price - s.entry_price) / s.entry_price;
    const pct = (s.side === "sell" ? -raw : raw) * 100;
    returnByMonth.set(key, (returnByMonth.get(key) ?? 0) + pct);
  }

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
