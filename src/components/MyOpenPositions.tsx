"use client";

import { useEffect, useRef, useState } from "react";
import { SymbolIcon } from "@/lib/symbol-icons";
import { useLivePrices } from "@/lib/use-live-prices";

type Position = {
  id: string;
  symbol: string;
  side: string;
  entry_price: number;
  size: number;
  take_profit: number | null;
  stop_loss: number | null;
};

function formatPrice(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function PositionRow({ pos, current }: { pos: Position; current: number | undefined }) {
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
    current != null ? ((current - pos.entry_price) / pos.entry_price) * (pos.side === "sell" ? -1 : 1) * 100 : null;
  const unrealizedPnl = pct != null ? (pct / 100) * Number(pos.size) : null;

  return (
    <div
      className={
        "flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 transition-colors duration-500 " +
        (flash === "up" ? "bg-success/10" : flash === "down" ? "bg-danger/10" : "")
      }
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background text-base">
          <SymbolIcon symbol={pos.symbol} />
        </span>
        <div>
          <p className="text-sm font-medium" dir="ltr">
            {pos.symbol}
          </p>
          <span
            className={
              pos.side === "buy"
                ? "rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent"
                : "rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-medium text-danger"
            }
          >
            {pos.side === "buy" ? "BUY" : "SELL"}
          </span>
        </div>
      </div>
      <div className="text-end">
        <p
          className={
            unrealizedPnl == null
              ? "text-sm font-semibold text-muted transition-colors duration-300"
              : unrealizedPnl >= 0
                ? "text-sm font-semibold text-success transition-colors duration-300"
                : "text-sm font-semibold text-danger transition-colors duration-300"
          }
          dir="ltr"
        >
          {unrealizedPnl != null
            ? `${unrealizedPnl >= 0 ? "+" : ""}$${unrealizedPnl.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
            : "—"}
        </p>
        <p className="text-xs text-muted" dir="ltr">
          {pct != null ? `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%` : "—"}
          {current != null && <> · {formatPrice(current)}</>}
        </p>
        {(pos.take_profit != null || pos.stop_loss != null) && (
          <p className="text-[11px] text-muted" dir="ltr">
            {pos.take_profit != null && <>TP {formatPrice(pos.take_profit)}</>}
            {pos.take_profit != null && pos.stop_loss != null && " · "}
            {pos.stop_loss != null && <>SL {formatPrice(pos.stop_loss)}</>}
          </p>
        )}
      </div>
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
  const symbols = Array.from(new Set(positions.map((p) => p.symbol)));
  const prices = useLivePrices(symbols, initialPrices);

  const totalUnrealizedPnl = positions.reduce((sum, p) => {
    const current = prices[p.symbol];
    if (current == null) return sum;
    const pct = ((current - p.entry_price) / p.entry_price) * (p.side === "sell" ? -1 : 1);
    return sum + pct * Number(p.size);
  }, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">إجمالي الربح/الخسارة العائم</span>
        {positions.length > 0 && (
          <span
            className={totalUnrealizedPnl >= 0 ? "text-sm font-semibold text-success" : "text-sm font-semibold text-danger"}
            dir="ltr"
          >
            {totalUnrealizedPnl >= 0 ? "+" : ""}
            ${totalUnrealizedPnl.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </span>
        )}
      </div>
      {positions.length === 0 ? (
        <p className="text-sm text-muted">لا توجد مراكز مفتوحة حاليًا. ستظهر هنا فور فتح متداول تنسخه لصفقة جديدة.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {positions.map((pos) => (
            <PositionRow key={pos.id} pos={pos} current={prices[pos.symbol]} />
          ))}
        </div>
      )}
    </div>
  );
}
