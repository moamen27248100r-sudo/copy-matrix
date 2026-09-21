import Link from "next/link";
import { chooseAccountType } from "@/app/auth/actions";
import { ConfirmButton } from "@/components/ConfirmButton";

type AccountType = "real" | "demo";

const SWITCH_WARNING =
  "التبديل بين الحساب الحقيقي والتجريبي يعيد ضبط الرصيد ويوقف النسخ الحالي. هل تريد المتابعة؟";

function money(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function ActionIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

// One consolidated balance card for the customer dashboard: total value,
// the account switch, the cash / reserved / floating-P&L breakdown, and the
// three primary money actions -- replacing what used to be two separate
// cards that repeated the same balance three times.
export function DashboardHero({
  accountType,
  balance,
  totalAllocated,
  totalUnrealizedPnl,
}: {
  accountType: AccountType;
  balance: number;
  totalAllocated: number;
  totalUnrealizedPnl: number;
}) {
  // balance already includes any reserved copy capital (allocated_amount is
  // a reservation on the same dollars, not separate money) -- only
  // unrealized P&L, not yet in balance until a position closes, is added.
  const totalValue = balance + totalUnrealizedPnl;
  const availableCash = Math.max(0, balance - totalAllocated);
  const pnlPct = balance > 0 ? (totalUnrealizedPnl / balance) * 100 : 0;
  const pnlPositive = totalUnrealizedPnl >= 0;

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted">قيمة المحفظة الإجمالية</span>

        <div className="flex gap-1 rounded-lg border border-border bg-background p-0.5 text-xs" role="group" aria-label="نوع الحساب">
          {(["real", "demo"] as const).map((t) =>
            t === accountType ? (
              <span key={t} className="rounded-md bg-accent px-3 py-1.5 font-medium text-accent-foreground">
                {t === "real" ? "حقيقي" : "تجريبي"}
              </span>
            ) : (
              <form key={t} action={chooseAccountType}>
                <input type="hidden" name="accountType" value={t} />
                <input type="hidden" name="next" value="/dashboard" />
                <ConfirmButton
                  confirmText={SWITCH_WARNING}
                  className="rounded-md px-3 py-1.5 text-muted transition hover:text-foreground"
                >
                  {t === "real" ? "حقيقي" : "تجريبي"}
                </ConfirmButton>
              </form>
            ),
          )}
        </div>
      </div>

      <div>
        <p className="text-4xl font-bold tracking-tight" dir="ltr">
          ${money(totalValue)}
        </p>
        <p className={`mt-1 text-sm ${pnlPositive ? "text-success" : "text-danger"}`} dir="ltr">
          {pnlPositive ? "+" : "-"}${money(Math.abs(totalUnrealizedPnl))} ({pnlPositive ? "+" : "-"}
          {Math.abs(pnlPct).toFixed(2)}%)
          <span className="ms-2 text-xs text-muted">ربح/خسارة غير محققة</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
        <div>
          <p className="text-xs text-muted">نقدي متاح للسحب</p>
          <p className="mt-0.5 font-semibold" dir="ltr">
            ${money(availableCash)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">محجوز لحساب النسخ النشط</p>
          <p className="mt-0.5 font-semibold" dir="ltr">
            ${money(totalAllocated)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Link
          href="/portfolio/deposit"
          className="flex items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2.5 text-sm font-medium text-accent-foreground transition hover:bg-accent-hover"
        >
          <ActionIcon>
            <path d="M12 5v14" />
            <path d="M5 12l7 7 7-7" />
          </ActionIcon>
          إيداع
        </Link>
        <Link
          href="/portfolio/withdraw"
          className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-medium transition hover:border-accent/50"
        >
          <ActionIcon>
            <path d="M5 12l7-7 7 7" />
            <path d="M12 5v14" />
          </ActionIcon>
          سحب
        </Link>
        <Link
          href="/discover"
          className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-medium transition hover:border-accent/50"
        >
          <ActionIcon>
            <circle cx="12" cy="12" r="10" />
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
          </ActionIcon>
          نسخ
        </Link>
      </div>
    </section>
  );
}
