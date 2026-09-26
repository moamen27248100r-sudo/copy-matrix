"use client";

import { useTranslations } from "next-intl";
import { SymbolIcon } from "@/lib/symbol-icons";
import { useLivePrices } from "@/lib/use-live-prices";
import { ConfirmButton } from "@/components/ConfirmButton";
import { closePosition } from "@/app/dashboard/actions";

type Position = {
  id: string;
  symbol: string;
  side: string;
  entry_price: number;
  size: number;
};

function formatPrice(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function PositionRow({ pos, current }: { pos: Position; current: number | undefined }) {
  const t = useTranslations("Dashboard");
  const pct =
    current != null ? ((current - pos.entry_price) / pos.entry_price) * (pos.side === "sell" ? -1 : 1) : null;
  const pnl = pct != null ? pct * Number(pos.size) : null;

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
        {formatPrice(pos.entry_price)}
      </td>
      <td className="py-3 text-sm" dir="ltr">
        {current != null ? formatPrice(current) : "—"}
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
          {pnl != null ? `${pnl >= 0 ? "+" : ""}$${pnl.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "—"}
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

export function CopiedPositionsTable({ positions }: { positions: Position[] }) {
  const t = useTranslations("Dashboard");
  const symbols = Array.from(new Set(positions.map((p) => p.symbol)));
  const prices = useLivePrices(symbols, {});

  if (positions.length === 0) {
    return <p className="text-sm text-muted">{t("noCopiedPositions")}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-start">
        <thead>
          <tr className="border-b border-slate-800 text-start text-xs text-muted">
            <th className="py-2 ps-1 text-start font-normal">{t("tableSymbol")}</th>
            <th className="py-2 text-start font-normal">{t("tableSide")}</th>
            <th className="py-2 text-start font-normal">{t("tableEntry")}</th>
            <th className="py-2 text-start font-normal">{t("tableMarket")}</th>
            <th className="py-2 text-start font-normal">{t("tablePnl")}</th>
            <th className="py-2 pe-1"></th>
          </tr>
        </thead>
        <tbody>
          {positions.map((pos) => (
            <PositionRow key={pos.id} pos={pos} current={prices[pos.symbol]} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
