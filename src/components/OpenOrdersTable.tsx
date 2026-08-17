import { symbolIcon } from "@/lib/symbol-icons";

type OpenOrder = {
  id: string;
  symbol: string;
  side: string;
  entry_price: number;
  opened_at: string;
};

export function OpenOrdersTable({
  orders,
  priceBySymbol,
}: {
  orders: OpenOrder[];
  priceBySymbol: Map<string, number>;
}) {
  if (orders.length === 0) {
    return <p className="text-sm text-muted">لا توجد صفقات مفتوحة حاليًا لهذا المتداول.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {orders.map((o) => {
        const current = priceBySymbol.get(o.symbol);
        const pct =
          current != null
            ? ((current - o.entry_price) / o.entry_price) * (o.side === "sell" ? -1 : 1) * 100
            : null;

        return (
          <div
            key={o.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background text-base">
                {symbolIcon(o.symbol)}
              </span>
              <div>
                <p className="text-sm font-medium" dir="ltr">
                  {o.symbol}
                </p>
                <span
                  className={
                    o.side === "buy"
                      ? "rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success"
                      : "rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-medium text-danger"
                  }
                >
                  {o.side === "buy" ? "شراء" : "بيع"}
                </span>
              </div>
            </div>
            <div className="text-end">
              <p
                className={
                  pct == null
                    ? "text-sm font-semibold text-muted"
                    : pct >= 0
                      ? "text-sm font-semibold text-success"
                      : "text-sm font-semibold text-danger"
                }
                dir="ltr"
              >
                {pct != null ? `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%` : "—"}
              </p>
              <p className="text-xs text-muted" dir="ltr">
                دخول {o.entry_price}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
