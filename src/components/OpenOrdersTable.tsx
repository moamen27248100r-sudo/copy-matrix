"use client";

import { useEffect, useRef, useState } from "react";
import { SymbolIcon } from "@/lib/symbol-icons";
import { useLivePrices } from "@/lib/use-live-prices";

type OpenOrder = {
  id: string;
  symbol: string;
  side: string;
  entry_price: number;
  opened_at: string;
  take_profit: number | null;
  stop_loss: number | null;
};

function formatPrice(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
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

  const pct =
    current != null
      ? ((current - order.entry_price) / order.entry_price) * (order.side === "sell" ? -1 : 1) * 100
      : null;
  const isProfit = pct != null && pct >= 0;

  return (
    <div
      className={
        "flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 transition-colors duration-500 " +
        (flash === "up" ? "bg-success/10" : flash === "down" ? "bg-danger/10" : "")
      }
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background text-base">
          <SymbolIcon symbol={order.symbol} />
        </span>
        <div>
          <p className="text-sm font-medium" dir="ltr">
            {order.symbol}
          </p>
          <span
            className={
              order.side === "buy"
                ? "rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent"
                : "rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-medium text-danger"
            }
          >
            {order.side === "buy" ? "BUY" : "SELL"}
          </span>
        </div>
      </div>
      <div className="text-end">
        <p
          className={
            pct == null
              ? "text-sm font-semibold text-muted transition-colors duration-300"
              : isProfit
                ? "text-sm font-semibold text-success transition-colors duration-300"
                : "text-sm font-semibold text-danger transition-colors duration-300"
          }
          dir="ltr"
        >
          {pct != null ? `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%` : "—"}
        </p>
        <p className="text-xs text-muted" dir="ltr">
          دخول {formatPrice(order.entry_price)}
          {current != null && <> · الحالي {formatPrice(current)}</>}
        </p>
        {(order.take_profit != null || order.stop_loss != null) && (
          <p className="text-[11px] text-muted" dir="ltr">
            {order.take_profit != null && <>TP {formatPrice(order.take_profit)}</>}
            {order.take_profit != null && order.stop_loss != null && " · "}
            {order.stop_loss != null && <>SL {formatPrice(order.stop_loss)}</>}
          </p>
        )}
      </div>
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
  const symbols = Array.from(new Set(orders.map((o) => o.symbol)));
  const prices = useLivePrices(symbols, initialPrices);

  if (orders.length === 0) {
    return <p className="text-sm text-muted">لا توجد صفقات مفتوحة حاليًا لهذا المتداول.</p>;
  }

  const totalPct = orders.reduce((sum, o) => {
    const current = prices[o.symbol];
    if (current == null) return sum;
    const pct = ((current - o.entry_price) / o.entry_price) * (o.side === "sell" ? -1 : 1) * 100;
    return sum + pct;
  }, 0);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between rounded-lg bg-background px-3 py-2">
        <span className="text-xs text-muted">إجمالي التذبذب العائم</span>
        <span
          className={totalPct >= 0 ? "text-sm font-semibold text-success" : "text-sm font-semibold text-danger"}
          dir="ltr"
        >
          {totalPct >= 0 ? "+" : ""}
          {totalPct.toFixed(2)}%
        </span>
      </div>
      {orders.map((o) => (
        <OrderRow key={o.id} order={o} current={prices[o.symbol]} />
      ))}
    </div>
  );
}
