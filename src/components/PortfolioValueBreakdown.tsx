import { getTranslations } from "next-intl/server";
import { getMoney } from "@/lib/money-server";
import { formatPct, profitPct } from "@/lib/profit-pct";

export async function PortfolioValueBreakdown({
  balance,
  totalAllocated,
  totalUnrealizedPnl,
  totalProfit,
  netInvested,
}: {
  balance: number;
  totalAllocated: number;
  totalUnrealizedPnl: number;
  /** Realized + floating result of the account. */
  totalProfit: number;
  /** Net invested funds; the base of the return % (lib/profit-pct.ts). */
  netInvested: number | null;
}) {
  const t = await getTranslations("Dashboard");
  const money = await getMoney();
  // balance already includes any allocated capital (followProvider never
  // actually deducts it — allocated_amount is a reservation on top of the
  // same dollars, not separate money), so only unrealized P&L — not yet
  // reflected in balance until a position closes — needs adding on top.
  const totalValue = balance + totalUnrealizedPnl;
  const availableCash = balance - totalAllocated;
  const returnPct = profitPct(totalProfit, netInvested);

  return (
    <div>
      <p className="text-xs text-muted">{t("portfolioValue")}</p>
      <p className="text-3xl font-semibold">
        <span dir="ltr" className="inline-block">
          {money(totalValue)}
        </span>
      </p>
      <div className="mt-3 grid grid-cols-3 gap-3 border-t border-border pt-3 text-sm">
        <div>
          <p className="font-semibold">
            <span dir="ltr" className="inline-block">
              {money(availableCash)}
            </span>
          </p>
          <p className="text-xs text-muted">{t("availableCash")}</p>
        </div>
        <div>
          <p className="font-semibold">
            <span dir="ltr" className="inline-block">
              {money(totalAllocated)}
            </span>
          </p>
          <p className="text-xs text-muted">{t("reservedForCopy")}</p>
        </div>
        <div>
          <p className={totalUnrealizedPnl >= 0 ? "font-semibold text-success" : "font-semibold text-danger"}>
            <span dir="ltr" className="inline-block">
              {money(totalUnrealizedPnl, { signed: true })}
            </span>
          </p>
          <p className="text-xs text-muted">{t("unrealizedPnl")}</p>
        </div>
      </div>
      {returnPct != null && (
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3 text-sm">
          <span className="text-xs text-muted">{t("returnOnInvested")}</span>
          <span dir="ltr" className={`font-semibold ${returnPct > 0 ? "text-success" : returnPct < 0 ? "text-danger" : ""}`}>
            {money(totalProfit, { signed: true })} ({formatPct(returnPct)})
          </span>
        </div>
      )}
    </div>
  );
}
