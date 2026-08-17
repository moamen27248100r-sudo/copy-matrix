import { symbolIcon } from "@/lib/symbol-icons";

const PALETTE = ["#38bdf8", "#f472b6", "#818cf8", "#fbbf24", "#94a3b8"];

export function AssetAllocationBar({ signals }: { signals: { symbol: string }[] }) {
  if (signals.length === 0) return null;

  const counts = new Map<string, number>();
  for (const s of signals) counts.set(s.symbol, (counts.get(s.symbol) ?? 0) + 1);

  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 4);
  const restCount = sorted.slice(4).reduce((sum, [, c]) => sum + c, 0);
  if (restCount > 0) top.push(["أخرى", restCount]);

  const total = signals.length;
  const segments = top.map(([symbol, count], i) => ({
    symbol,
    pct: Math.round((count / total) * 100),
    color: PALETTE[i % PALETTE.length],
  }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-border">
        {segments.map((seg) => (
          <div key={seg.symbol} style={{ width: `${seg.pct}%`, backgroundColor: seg.color }} title={seg.symbol} />
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
            <span className="text-xs font-semibold">{seg.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
