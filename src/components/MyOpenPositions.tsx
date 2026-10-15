"use client";

import { useMoney } from "@/lib/money-client";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLivePricesMeta } from "@/lib/use-live-prices";
import { FOREX_SYMBOLS, lotsFromSize, openPositionPnl } from "@/lib/pip-specs";
import { ForexAsOfNote } from "@/components/ForexAsOfNote";
import { TradeRow } from "@/components/trades/TradeRow";
import { formatTradePrice } from "@/lib/trade-format";
import { updatePositionTpSl } from "@/app/trades/actions";

type Position = {
  id: string;
  symbol: string;
  side: string;
  entry_price: number;
  size: number;
  opened_at?: string | null;
  take_profit: number | null;
  stop_loss: number | null;
};

function PositionRow({
  pos,
  current,
  forexAsOf,
  returnTo,
}: {
  pos: Position;
  current: number | undefined;
  forexAsOf: string | undefined;
  returnTo: string;
}) {
  const tt = useTranslations("Trades");
  const [editing, setEditing] = useState(false);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const prevPrice = useRef<number | undefined>(current);

  useEffect(() => {
    if (current == null) return;
    if (prevPrice.current != null && current !== prevPrice.current) {
      setFlash(current > prevPrice.current ? "up" : "down");
      const t = setTimeout(() => setFlash(null), 500);
      prevPrice.current = current;
      return () => clearTimeout(t);
    }
    prevPrice.current = current;
  }, [current]);

  const live = current != null ? openPositionPnl(pos.side, pos.entry_price, current, Number(pos.size)) : null;
  const pct = live?.pct ?? null;
  const unrealizedPnl = live?.usd ?? null;
  const lots = lotsFromSize(pos.symbol, pos.entry_price, Number(pos.size));

  return (
    <div
      className={
        "rounded-lg py-[5px] transition-colors duration-500 " +
        (flash === "up" ? "bg-success/10" : flash === "down" ? "bg-danger/10" : "")
      }
    >
      <TradeRow
        symbol={pos.symbol}
        side={pos.side}
        lots={lots}
        pnl={unrealizedPnl}
        pct={pct}
        from={pos.entry_price}
        to={current}
        date={pos.opened_at}
      />
      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-xs text-muted" dir="ltr">
        <span>
          {(pos.take_profit != null || pos.stop_loss != null) && (
            <>
              {pos.take_profit != null && <>TP {formatTradePrice(pos.take_profit, pos.symbol)}</>}
              {pos.take_profit != null && pos.stop_loss != null && " · "}
              {pos.stop_loss != null && <>SL {formatTradePrice(pos.stop_loss, pos.symbol)}</>}
            </>
          )}
          {FOREX_SYMBOLS.includes(pos.symbol) && <ForexAsOfNote asOf={forexAsOf} />}
        </span>
        <button type="button" onClick={() => setEditing((v) => !v)} className="font-medium text-accent hover:underline">
          {tt("editTpSl")}
        </button>
      </div>
      {editing && (
        <form action={updatePositionTpSl} className="mt-2 flex w-full flex-wrap items-end gap-2 border-t border-border pt-3 text-xs">
          <input type="hidden" name="positionId" value={pos.id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <label className="flex min-w-[96px] flex-1 flex-col gap-1 text-muted">
            {tt("tpLabel")}
            <input name="takeProfit" type="number" step="any" min="0" defaultValue={pos.take_profit ?? ""} dir="ltr" className="rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
          </label>
          <label className="flex min-w-[96px] flex-1 flex-col gap-1 text-muted">
            {tt("slLabel")}
            <input name="stopLoss" type="number" step="any" min="0" defaultValue={pos.stop_loss ?? ""} dir="ltr" className="rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground" />
          </label>
          <button type="submit" className="rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground">
            {tt("tpSlSave")}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="rounded border border-border px-3 py-1.5 text-xs text-muted">
            {tt("tpSlCancel")}
          </button>
          <p className="w-full text-[11px] text-muted">{tt("tpSlHint")}</p>
        </form>
      )}
    </div>
  );
}

export function MyOpenPositions({
  positions,
  initialPrices,
}: {
  positions: Position[];
  initialPrices: Record<string, number>;
}) {
  const t = useTranslations("Portfolio");
  const money = useMoney();
  const pathname = usePathname();
  const returnTo = pathname;
  const symbols = Array.from(new Set(positions.map((p) => p.symbol)));
  const { prices, forexAsOf } = useLivePricesMeta(symbols, initialPrices);

  const totalUnrealizedPnl = positions.reduce((sum, p) => {
    const current = prices[p.symbol];
    if (current == null) return sum;
    const pct = ((current - p.entry_price) / p.entry_price) * (p.side === "sell" ? -1 : 1);
    return sum + pct * Number(p.size);
  }, 0);

  return (
    <div className="flex flex-col gap-3">
      {positions.length > 0 && (
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{t("totalFloatingPnl")}</span>
        {(
          <span
            className={totalUnrealizedPnl >= 0 ? "text-sm font-semibold text-success" : "text-sm font-semibold text-danger"}
            dir="ltr"
          >
            {money(totalUnrealizedPnl, { signed: true })}
          </span>
        )}
      </div>
      )}
      {positions.length === 0 ? (
        <p className="text-sm text-muted">{t("noOpenPositions")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {positions.map((pos) => (
            <PositionRow key={pos.id} pos={pos} current={prices[pos.symbol]} forexAsOf={forexAsOf[pos.symbol]} returnTo={returnTo} />
          ))}
        </div>
      )}
    </div>
  );
}
