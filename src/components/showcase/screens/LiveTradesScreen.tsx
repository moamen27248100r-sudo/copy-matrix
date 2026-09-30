import { StatusBar, BottomNav } from "../ScreenChrome";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("HomeShowcase");
  const seed = seedOf(trade.symbol);
  const pnl = jitter(trade.pnl, seed, tick);
  const up = pnl >= 0;
  const flash = (tick + seed) % 4 === 0;

  return (
    <div
      className={
        "flex items-center justify-between gap-2 rounded-xl border border-white/[0.06] px-3.5 py-3 transition-colors duration-500 " +
        (flash ? (up ? "bg-[#22C55E]/10" : "bg-[#EF4444]/10") : "bg-white/[0.02]")
      }
    >
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base"
          style={{ backgroundColor: `${symbolColor(trade.symbol)}22` }}
        >
          <SymbolIcon symbol={trade.symbol} />
        </span>
        <div>
          <p className="text-[15px] font-medium text-white" dir="ltr">
            {trade.symbol}
          </p>
          <div className="flex items-center gap-1.5">
            <span
              className={
                "rounded-full px-2 py-0.5 text-[11px] font-semibold " +
                (trade.side === "buy" ? "bg-accent/15 text-accent" : "bg-[#EF4444]/15 text-[#EF4444]")
              }
            >
              {trade.side === "buy" ? t("buy") : t("sell")}
            </span>
            <span className="text-[11px] text-muted" dir="ltr">
              {trade.lot}
            </span>
          </div>
        </div>
      </div>
      <p className={"text-base font-bold tabular-nums " + (up ? "text-[#22C55E]" : "text-[#EF4444]")} dir="ltr">
        {up ? "+" : ""}
        {pnl.toFixed(2)}$
      </p>
    </div>
  );
}

export function LiveTradesScreen({ tick }: { tick: number }) {
  const t = useTranslations("HomeShowcase");
  const total = showcaseOpenTrades.reduce((sum, tr) => sum + jitter(tr.pnl, seedOf(tr.symbol), tick), 0);
  const up = total >= 0;

  return (
    <div className="flex h-full flex-col" dir="rtl" aria-hidden="true">
      <StatusBar />
      <div className="flex flex-1 flex-col gap-4 px-5 pt-5">
        <div className="flex items-center justify-between">
          <p className="text-lg font-semibold text-white">{t("yourCopied")}</p>
          <span className="flex items-center gap-1.5 rounded-full bg-[#22C55E]/10 px-2.5 py-1.5 text-xs font-semibold text-[#22C55E]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#22C55E]" />
            {t("live")}
          </span>
        </div>

        <p className={"text-4xl font-extrabold tabular-nums " + (up ? "text-[#22C55E]" : "text-[#EF4444]")} dir="ltr">
          {up ? "+" : ""}
          {total.toFixed(2)}$
        </p>

        <div className="flex flex-1 flex-col justify-center gap-2.5">
          {showcaseOpenTrades.map((trade) => (
            <TradeRow key={trade.symbol} trade={trade} tick={tick} />
          ))}
        </div>
      </div>
      <BottomNav active="trades" />
    </div>
  );
}
