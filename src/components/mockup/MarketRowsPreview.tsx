"use client";

import { MarketRow, type BoardRow } from "@/components/markets/MarketsBoard";

// The real market rows with fixed prices, for the home-page mock-up (no feed, no star actions).
export function MarketRowsPreview({ rows }: { rows: Omit<BoardRow, "volume" | "high" | "low">[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r, i) => (
        <MarketRow key={r.symbol} r={r} flash={undefined} starred={i < 3} onToggle={() => {}} phoneWidth />
      ))}
    </ul>
  );
}
