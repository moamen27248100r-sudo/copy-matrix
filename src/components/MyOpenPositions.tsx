"use client";

import { useEffect, useState } from "react";
import { SymbolIcon } from "@/lib/symbol-icons";

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

export function MyOpenPositions({
  positions,
  initialPrices,
}: {
  positions: Position[];
  initialPrices: Record<string, number>;
}) {
  const [prices, setPrices] = useState<Record<string, number>>(initialPrices);

  useEffect(() => {
    if (positions.length === 0) return;
    const symbols = Array.from(new Set(positions.map((p) => p.symbol)));

    let stopped = false;
    let es: EventSource | null = null;

    const connect = () => {
      if (stopped) return;
      es = new EventSource(`/api/live-prices?symbols=${encodeURIComponent(symbols.join(","))}`);
      es.addEventListener("prices", (e) => {
        try {
          const payload = JSON.parse((e as MessageEvent).data) as Record<string, number>;
          setPrices((prev) => ({ ...prev, ...payload }));
        } catch {
          // ignore malformed tick
        }
      });
      es.onerror = () => {
        es?.close();
        if (!stopped) setTimeout(connect, 2000);
      };
    };

    connect();
    return () => {
      stopped = true;
      es?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions.map((p) => p.symbol).join(",")]);

  const withPnl = positions.map((p) => {
    const current = prices[p.symbol];
    const pct =
      current != null ? ((current - p.entry_price) / p.entry_price) * (p.side === "sell" ? -1 : 1) * 100 : null;
    const unrealizedPnl = pct != null ? (pct / 100) * Number(p.size) : null;
    return { pos: p, current, pct, unrealizedPnl };
  });
  const totalUnrealizedPnl = withPnl.reduce((sum, o) => sum + (o.unrealizedPnl ?? 0), 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">المراكز المفتوحة</h2>
        {withPnl.length > 0 && (
          <span
            className={totalUnrealizedPnl >= 0 ? "text-sm font-semibold text-success" : "text-sm font-semibold text-danger"}
            dir="ltr"
          >
            {totalUnrealizedPnl >= 0 ? "+" : ""}
            ${totalUnrealizedPnl.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </span>
        )}
      </div>
      {withPnl.length === 0 ? (
        <p className="text-sm text-muted">لا توجد مراكز مفتوحة حاليًا. ستظهر هنا فور فتح متداول تنسخه لصفقة جديدة.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {withPnl.map(({ pos, current, pct, unrealizedPnl }) => (
            <div
              key={pos.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3"
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
                        ? "rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success"
                        : "rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-medium text-danger"
                    }
                  >
                    {pos.side === "buy" ? "شراء" : "بيع"}
                  </span>
                </div>
              </div>
              <div className="text-end">
                <p
                  className={
                    unrealizedPnl == null
                      ? "text-sm font-semibold text-muted"
                      : unrealizedPnl >= 0
                        ? "text-sm font-semibold text-success"
                        : "text-sm font-semibold text-danger"
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
          ))}
        </div>
      )}
    </div>
  );
}
