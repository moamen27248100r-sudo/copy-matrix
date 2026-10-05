import { getTranslations } from "next-intl/server";
import { symbolColor, OTHER_COLOR } from "@/lib/symbol-icons";

const OTHER = "__other__";

// Share of the leader's trades per symbol (provider_stats.asset_mix: trade
// counts by symbol).
export async function AssetAllocationBar({ mix }: { mix: Record<string, number> }) {
  const counts = new Map(Object.entries(mix).map(([s, n]) => [s, Number(n)] as const));
  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const t = await getTranslations("Common");

  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 4);
  const restCount = sorted.slice(4).reduce((sum, [, c]) => sum + c, 0);
  if (restCount > 0) top.push([OTHER, restCount]);

  // Keep the bar's actual widths as exact fractions (not pre-rounded) so the
  // segments always sum to precisely 100% and fill the bar with no gaps —
  // only the displayed percentage labels are rounded, for readability.
  const segments = top.map(([symbol, count]) => ({
    symbol,
    label: symbol === OTHER ? t("other") : symbol,
    widthPct: (count / total) * 100,
    displayPct: Math.round((count / total) * 100),
    color: symbol === OTHER ? OTHER_COLOR : symbolColor(symbol),
  }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-border">
        {segments.map((seg) => (
          <div
            key={seg.symbol}
            className="shrink-0"
            style={{ width: `${seg.widthPct}%`, backgroundColor: seg.color }}
            title={seg.label}
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
                {seg.label}
              </span>
            </div>
            <span className="text-sm font-bold">{seg.displayPct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
