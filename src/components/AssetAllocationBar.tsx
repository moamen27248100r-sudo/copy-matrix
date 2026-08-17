import { symbolIcon } from "@/lib/symbol-icons";

// Calm, well-known colors (standard Tailwind palette) instead of loud/unusual hues.
const PALETTE = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#64748b"];

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
  const segments = top.map(([symbol, count], i) => ({
    symbol,
    widthPct: (count / total) * 100,
    displayPct: Math.round((count / total) * 100),
    color: PALETTE[i % PALETTE.length],
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
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {segments.map((seg) => (
          <div key={seg.symbol} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: seg.color }}
              aria-hidden="true"
            />
            <span className="text-sm">{seg.symbol === "أخرى" ? "🔹" : symbolIcon(seg.symbol)}</span>
            <span className="text-xs text-muted">{seg.symbol}</span>
            <span className="text-xs font-semibold">{seg.displayPct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
