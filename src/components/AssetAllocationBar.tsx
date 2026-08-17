import { symbolColor, OTHER_COLOR } from "@/lib/symbol-icons";

export function AssetAllocationBar({ signals }: { signals: { symbol: string }[] }) {
  if (signals.length === 0) return null;

  const counts = new Map<string, number>();
  for (const s of signals) counts.set(s.symbol, (counts.get(s.symbol) ?? 0) + 1);

  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 4);
  const restCount = sorted.slice(4).reduce((sum, [, c]) => sum + c, 0);
  if (restCount > 0) top.push(["أخرى", restCount]);

  const total = signals.length;
  // Keep the bar's actual widths as exact fractions (not pre-rounded) so the
  // segments always sum to precisely 100% and fill the bar with no gaps —
  // only the displayed percentage labels are rounded, for readability.
  const segments = top.map(([symbol, count]) => ({
    symbol,
    widthPct: (count / total) * 100,
    displayPct: Math.round((count / total) * 100),
    color: symbol === "أخرى" ? OTHER_COLOR : symbolColor(symbol),
  }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-border">
        {segments.map((seg) => (
          <div
            key={seg.symbol}
            className="shrink-0"
            style={{ width: `${seg.widthPct}%`, backgroundColor: seg.color }}
            title={seg.symbol}
          />
        ))}
      </div>
      <div className="flex flex-wrap justify-between gap-x-3 gap-y-3">
        {segments.map((seg) => (
          <div key={seg.symbol} className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: seg.color }}
                aria-hidden="true"
              />
              <span className="text-xs text-muted" dir="ltr">
                {seg.symbol}
              </span>
            </div>
            <span className="text-sm font-bold">{seg.displayPct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
