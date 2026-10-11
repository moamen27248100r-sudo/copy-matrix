"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { TradeRow } from "@/components/trades/TradeRow";
import { useLivePricesMeta } from "@/lib/use-live-prices";
import { FOREX_SYMBOLS, lotsFromSize, openPositionPnl } from "@/lib/pip-specs";
import { ForexAsOfNote } from "@/components/ForexAsOfNote";
import { ConfirmButton } from "@/components/ConfirmButton";
import { closePosition } from "@/app/dashboard/actions";

type Position = {
  id: string;
  symbol: string;
  side: string;
  entry_price: number;
  size: number;
  opened_at?: string | null;
  traderName?: string;
};

function PositionRow({ pos, current, forexAsOf }: { pos: Position; current: number | undefined; forexAsOf: string | undefined }) {
  const t = useTranslations("Dashboard");
  const live = current != null ? openPositionPnl(pos.side, pos.entry_price, current, Number(pos.size)) : null;
  const lots = lotsFromSize(pos.symbol, pos.entry_price, Number(pos.size));

  return (
    <div className="py-[5px]">
      <TradeRow
        symbol={pos.symbol}
        side={pos.side}
        lots={lots}
        pnl={live?.usd ?? null}
        pct={live?.pct ?? null}
        from={pos.entry_price}
        to={current}
        date={pos.opened_at}
      />
      <div className="mt-1 flex items-center justify-between gap-3 text-xs text-muted">
        <span className="min-w-0 truncate">
          {pos.traderName ? pos.traderName : null}
          {FOREX_SYMBOLS.includes(pos.symbol) && <ForexAsOfNote asOf={forexAsOf} />}
        </span>
        <form action={closePosition}>
          <input type="hidden" name="positionId" value={pos.id} />
          <ConfirmButton
            confirmText={t("closeTradeConfirm")}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-danger/50 hover:text-danger"
          >
            {t("closeTrade")}
          </ConfirmButton>
        </form>
      </div>
    </div>
  );
}

export function CopiedPositionsTable({
  positions,
  limit,
  viewAllHref,
}: {
  positions: Position[];
  limit?: number;
  viewAllHref?: string;
}) {
  const t = useTranslations("Dashboard");
  const shown = limit ? positions.slice(0, limit) : positions;
  const symbols = Array.from(new Set(shown.map((p) => p.symbol)));
  const { prices, forexAsOf } = useLivePricesMeta(symbols, {});

  if (positions.length === 0) {
    return <p className="text-sm text-muted">{t("noCopiedPositions")}</p>;
  }

  return (
    <div>
      <div className="flex flex-col">
        {shown.map((pos) => (
          <PositionRow key={pos.id} pos={pos} current={prices[pos.symbol]} forexAsOf={forexAsOf[pos.symbol]} />
        ))}
      </div>
      {viewAllHref && positions.length > shown.length && (
        <Link href={viewAllHref} className="mt-3 block text-center text-sm text-accent hover:underline">
          {t("viewAllPositions", { count: positions.length })}
        </Link>
      )}
    </div>
  );
}
