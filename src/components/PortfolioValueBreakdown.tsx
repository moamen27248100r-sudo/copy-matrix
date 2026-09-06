function money(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function PortfolioValueBreakdown({
  balance,
  totalAllocated,
  totalUnrealizedPnl,
}: {
  balance: number;
  totalAllocated: number;
  totalUnrealizedPnl: number;
}) {
  // balance already includes any allocated capital (followProvider never
  // actually deducts it — allocated_amount is a reservation on top of the
  // same dollars, not separate money), so only unrealized P&L — not yet
  // reflected in balance until a position closes — needs adding on top.
  const totalValue = balance + totalUnrealizedPnl;
  const availableCash = balance - totalAllocated;

  return (
    <div>
      <p className="text-xs text-muted">قيمة المحفظة الإجمالية</p>
      <p className="text-3xl font-semibold" dir="ltr">
        ${money(totalValue)}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-3 border-t border-border pt-3 text-sm">
        <div>
          <p className="font-semibold" dir="ltr">
            ${money(availableCash)}
          </p>
          <p className="text-xs text-muted">نقدي متاح للسحب</p>
        </div>
        <div>
          <p className="font-semibold" dir="ltr">
            ${money(totalAllocated)}
          </p>
          <p className="text-xs text-muted">محجوز لحساب النسخ النشط</p>
        </div>
        <div>
          <p className={totalUnrealizedPnl >= 0 ? "font-semibold text-success" : "font-semibold text-danger"} dir="ltr">
            {totalUnrealizedPnl >= 0 ? "+" : ""}
            ${money(totalUnrealizedPnl)}
          </p>
          <p className="text-xs text-muted">ربح/خسارة غير محققة</p>
        </div>
      </div>
    </div>
  );
}
