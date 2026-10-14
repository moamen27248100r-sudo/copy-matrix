import { Roboto_Condensed } from "next/font/google";
import { useTranslations } from "next-intl";
import { formatTradeDate, formatTradeLots, formatTradePnl, formatTradePrice } from "@/lib/trade-format";

// The one row every trade list renders, laid out like the History tab of
// MetaTrader 5:
//
//   XAUUSD sell 0.1                    -389.58
//   4398.543 → 4408.795   2026.10.09 02:57:30
//
// Presentational only (no hooks, no handlers) so server and client lists share
// it; a list that expands rows wraps it in its own button.

const condensed = Roboto_Condensed({ subsets: ["latin"], display: "swap" });

export const TRADE_BLUE = "#1A8CFF";
export const TRADE_RED = "#FF453A";
export const TRADE_GRAY = "#8E8E93";

export function TradeRow({
  symbol,
  side,
  lots,
  pnl,
  pct,
  from,
  to,
  date,
  className = "",
}: {
  symbol: string;
  side: string;
  /** Lot size; omitted when unknown. */
  lots?: number | null;
  /** Result in money; when null the result falls back to `pct`, then "—". */
  pnl: number | null;
  /** Return in percent, shown only when there is no money result. */
  pct?: number | null;
  from: number | null | undefined;
  /** Close price, or the current price for an open trade. */
  to: number | null | undefined;
  date?: string | null;
  className?: string;
}) {
  const tSide = useTranslations("TradeHistory");
  const buy = side === "buy";
  const sideLabel = buy ? tSide("sideBuy") : tSide("sideSell");
  const sideColor = buy ? TRADE_BLUE : TRADE_RED;
  const result = pnl ?? pct ?? null;
  const resultColor = result == null ? TRADE_GRAY : result >= 0 ? TRADE_BLUE : TRADE_RED;
  const resultText =
    pnl != null ? formatTradePnl(pnl) : pct != null ? `${pct < 0 ? "-" : ""}${Math.abs(pct).toFixed(2)}%` : "—";
  const dateText = formatTradeDate(date);

  return (
    <div dir="ltr" className={`flex flex-col gap-1 tabular-nums ${className}`}>
      <div className={`${condensed.className} flex items-baseline justify-between gap-3 text-xl leading-tight md:text-lg`}>
        <span className="flex min-w-0 items-baseline gap-2 truncate">
          <span className="font-semibold text-white">{symbol}</span>
          <span className="font-semibold" style={{ color: sideColor }}>
            {sideLabel}
            {lots != null && ` ${formatTradeLots(lots)}`}
          </span>
        </span>
        <span className="shrink-0 font-bold" style={{ color: resultColor }}>
          {resultText}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-3 text-base leading-tight md:text-sm" style={{ color: TRADE_GRAY }}>
        <span className="whitespace-nowrap">
          {from != null ? formatTradePrice(from, symbol) : "—"} → {to != null ? formatTradePrice(to, symbol) : "—"}
        </span>
        {dateText && <span className="whitespace-nowrap">{dateText}</span>}
      </div>
    </div>
  );
}
