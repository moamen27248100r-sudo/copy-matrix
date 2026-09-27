import { StatusBar, BottomNav } from "../ScreenChrome";
import { SymbolIcon, symbolColor } from "@/lib/symbol-icons";
import { showcaseOpenTrades, type OpenTrade } from "@/data/showcase-data";

// Deterministic (not Math.random()) small oscillation around each base
// value, seeded by the symbol's own char code so it's stable per row --
// safe for SSR since tick starts at 0 on both server and client.
function jitter(base: number, seed: number, tick: number) {
  return base + Math.sin((tick + seed) * 0.6) * Math.max(4, Math.abs(base) * 0.08);
}

function seedOf(symbol: string) {
  return symbol.charCodeAt(0) + symbol.charCodeAt(symbol.length - 1);
}

function TradeRow({ trade, tick }: { trade: OpenTrade; tick: number }) {
  const seed = seedOf(trade.symbol);
  const pnl = jitter(trade.pnl, seed, tick);
  const up = pnl >= 0;
  const flash = (tick + seed) % 4 === 0;

  return (
    <div
      className={
        "flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] px-2.5 py-2 transition-colors duration-500 " +
        (flash ? (up ? "bg-[#22C55E]/10" : "bg-[#EF4444]/10") : "bg-white/[0.02]")
      }
    >
      <div className="flex items-center gap-2">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm"
          style={{ backgroundColor: `${symbolColor(trade.symbol)}22` }}
        >
          <SymbolIcon symbol={trade.symbol} />
        </span>
        <div>
          <p className="text-[11px] font-medium text-white" dir="ltr">
            {trade.symbol}
          </p>
          <div className="flex items-center gap-1">
            <span
              className={
                "rounded-full px-1.5 py-0.5 text-[9px] font-semibold " +
                (trade.side === "buy" ? "bg-accent/15 text-accent" : "bg-[#EF4444]/15 text-[#EF4444]")
              }
            >
              {trade.side === "buy" ? "شراء" : "بيع"}
            </span>
            <span className="text-[9px] text-muted" dir="ltr">
              {trade.lot}
            </span>
          </div>
        </div>
      </div>
      <p className={"text-[12px] font-bold tabular-nums " + (up ? "text-[#22C55E]" : "text-[#EF4444]")} dir="ltr">
        {up ? "+" : ""}
        {pnl.toFixed(2)}$
      </p>
    </div>
  );
}

export function LiveTradesScreen({ tick }: { tick: number }) {
  const total = showcaseOpenTrades.reduce((sum, tr) => sum + jitter(tr.pnl, seedOf(tr.symbol), tick), 0);
  const up = total >= 0;

  return (
    <div className="flex h-full flex-col" dir="rtl" aria-hidden="true">
      <StatusBar />
      <div className="flex flex-1 flex-col gap-3 px-4 pt-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white">صفقاتك المنسوخة</p>
          <span className="flex items-center gap-1 rounded-full bg-[#22C55E]/10 px-2 py-1 text-[10px] font-semibold text-[#22C55E]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#22C55E]" />
            مباشر
          </span>
        </div>

        <p className={"text-2xl font-extrabold tabular-nums " + (up ? "text-[#22C55E]" : "text-[#EF4444]")} dir="ltr">
          {up ? "+" : ""}
          {total.toFixed(2)}$
        </p>

        <div className="flex flex-col gap-2">
          {showcaseOpenTrades.map((trade) => (
            <TradeRow key={trade.symbol} trade={trade} tick={tick} />
          ))}
        </div>
      </div>
      <BottomNav active="trades" />
    </div>
  );
}
