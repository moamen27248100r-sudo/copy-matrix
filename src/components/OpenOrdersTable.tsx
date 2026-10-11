"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { TradeRow } from "@/components/trades/TradeRow";
import { formatTradePrice } from "@/lib/trade-format";
import { useLivePrices } from "@/lib/use-live-prices";
import { useMoney } from "@/lib/money-client";
import { tradeProfitUsd, tradeReturnPct } from "@/lib/pip-specs";

type OpenOrder = {
  id: string;
  symbol: string;
  side: string;
  entry_price: number;
  opened_at: string;
  take_profit: number | null;
  stop_loss: number | null;
  lot_size: number | null;
};

// Unrealised result at the live price: dollars from the lot size (same pip
// conventions as the closed trades), and the price move in the trade's favour.
function floating(order: OpenOrder, current: number | undefined) {
  if (current == null) return { usd: null, pct: null };
  const entry = Number(order.entry_price);
  return {
    usd: tradeProfitUsd(order.symbol, order.side, entry, current, order.lot_size == null ? null : Number(order.lot_size)),
    pct: tradeReturnPct(order.side, entry, current),
  };
}

// Live-updating row: flashes its price briefly whenever a fresh tick
// actually changes the value, so the "alive" feel doesn't rely on the
// unchanging forex daily rate ticking every 2s with the exact same number.
function OrderRow({ order, current }: { order: OpenOrder; current: number | undefined }) {
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

  const { usd, pct } = floating(order, current);

  return (
    <div
      className={
        "rounded-lg py-[5px] transition-colors duration-500 " +
        (flash === "up" ? "bg-success/10" : flash === "down" ? "bg-danger/10" : "")
      }
    >
      <TradeRow
        symbol={order.symbol}
        side={order.side}
        lots={order.lot_size != null ? Number(order.lot_size) : null}
        pnl={usd}
        pct={pct != null ? pct : null}
        from={order.entry_price}
        to={current}
        date={order.opened_at}
      />
      {(order.take_profit != null || order.stop_loss != null) && (
        <p className="mt-1 text-xs text-muted" dir="ltr">
          {order.take_profit != null && <>TP {formatTradePrice(order.take_profit, order.symbol)}</>}
          {order.take_profit != null && order.stop_loss != null && " · "}
          {order.stop_loss != null && <>SL {formatTradePrice(order.stop_loss, order.symbol)}</>}
        </p>
      )}
    </div>
  );
}

export function OpenOrdersTable({
  orders,
  initialPrices,
}: {
  orders: OpenOrder[];
  initialPrices: Record<string, number>;
}) {
  const t = useTranslations("OpenOrders");
  const money = useMoney();
  const symbols = Array.from(new Set(orders.map((o) => o.symbol)));
  const prices = useLivePrices(symbols, initialPrices);

  if (orders.length === 0) {
    return <p className="text-sm text-muted">{t("noOpenOrders")}</p>;
  }

  // Sum of the trades' dollar results (in cents, so the total is exact).
  const totalCents = orders.reduce((sum, o) => sum + Math.round((floating(o, prices[o.symbol]).usd ?? 0) * 100), 0);
  const total = totalCents / 100;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between rounded-lg bg-background px-3 py-2">
        <span className="text-xs text-muted">{t("totalFloatingPnl")}</span>
        <span
          className={total >= 0 ? "text-sm font-semibold text-success" : "text-sm font-semibold text-danger"}
          dir="ltr"
        >
          {money(total, { signed: true })}
        </span>
      </div>
      {orders.map((o) => (
        <OrderRow key={o.id} order={o} current={prices[o.symbol]} />
      ))}
    </div>
  );
}
