"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { SymbolIcon } from "@/lib/symbol-icons";
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
  traderName?: string;
};

function formatPrice(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function PositionRow({ pos, current, forexAsOf }: { pos: Position; current: number | undefined; forexAsOf: string | undefined }) {
  const t = useTranslations("Dashboard");
  const tl = useTranslations("LivePrices");
  const live = current != null ? openPositionPnl(pos.side, pos.entry_price, current, Number(pos.size)) : null;
  const pnl = live?.usd ?? null;
  const pct = live?.pct ?? null;
  const lots = lotsFromSize(pos.symbol, pos.entry_price, Number(pos.size));

  return (
    <tr className="border-b border-slate-800 last:border-b-0">
      <td className="py-3 ps-1">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm">
            <SymbolIcon symbol={pos.symbol} />
          </span>
          <span className="text-sm font-medium" dir="ltr">
            {pos.symbol}
          </span>
        </div>
      </td>
      {pos.traderName !== undefined && (
        <td className="max-w-[120px] truncate py-3 pe-2 text-sm text-muted">{pos.traderName || "—"}</td>
      )}
      <td className="py-3">
        <span
          className={
            pos.side === "buy"
              ? "rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent"
              : "rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-medium text-danger"
          }
        >
          {pos.side === "buy" ? "Buy" : "Sell"}
        </span>
      </td>
      <td className="py-3 text-sm text-muted" dir="ltr">
        {lots != null ? tl("lots", { lots }) : "—"}
      </td>
      <td className="py-3 text-sm text-muted" dir="ltr">
        {formatPrice(pos.entry_price)}
      </td>
      <td className="py-3 text-sm" dir="ltr">
        {current != null ? formatPrice(current) : "—"}
        {FOREX_SYMBOLS.includes(pos.symbol) && <ForexAsOfNote asOf={forexAsOf} />}
      </td>
      <td className="py-3">
        <span
          className={
            pnl == null
              ? "text-sm font-semibold text-muted"
              : pnl >= 0
                ? "text-sm font-semibold text-success"
                : "text-sm font-semibold text-danger"
          }
          dir="ltr"
        >
          {pnl != null ? `${pnl >= 0 ? "+" : "-"}$${Math.abs(pnl).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
          {pct != null && (
            <span className="block text-[11px] font-normal opacity-80">{`${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`}</span>
          )}
        </span>
      </td>
      <td className="py-3 pe-1 text-end">
        <form action={closePosition}>
          <input type="hidden" name="positionId" value={pos.id} />
          <ConfirmButton
            confirmText={t("closeTradeConfirm")}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-danger/50 hover:text-danger"
          >
            {t("closeTrade")}
          </ConfirmButton>
        </form>
      </td>
    </tr>
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
  const showTrader = shown.some((p) => p.traderName !== undefined);
  const symbols = Array.from(new Set(shown.map((p) => p.symbol)));
  const { prices, forexAsOf } = useLivePricesMeta(symbols, {});

  if (positions.length === 0) {
    return <p className="text-sm text-muted">{t("noCopiedPositions")}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px] border-collapse text-start">
        <thead>
          <tr className="border-b border-slate-800 text-start text-xs text-muted">
            <th className="py-2 ps-1 text-start font-normal">{t("tableSymbol")}</th>
            {showTrader && <th className="py-2 text-start font-normal">{t("tableTrader")}</th>}
            <th className="py-2 text-start font-normal">{t("tableSide")}</th>
            <th className="py-2 text-start font-normal">{t("tableSize")}</th>
            <th className="py-2 text-start font-normal">{t("tableEntry")}</th>
            <th className="py-2 text-start font-normal">{t("tableMarket")}</th>
            <th className="py-2 text-start font-normal">{t("tablePnl")}</th>
            <th className="py-2 pe-1"></th>
          </tr>
        </thead>
        <tbody>
          {shown.map((pos) => (
            <PositionRow key={pos.id} pos={pos} current={prices[pos.symbol]} forexAsOf={forexAsOf[pos.symbol]} />
          ))}
        </tbody>
      </table>
      {viewAllHref && positions.length > shown.length && (
        <Link href={viewAllHref} className="mt-3 block text-center text-sm text-accent hover:underline">
          {t("viewAllPositions", { count: positions.length })}
        </Link>
      )}
    </div>
  );
}
