import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { chooseAccountType } from "@/app/auth/actions";
import { ConfirmButton } from "@/components/ConfirmButton";

type AccountType = "real" | "demo";

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
export async function DashboardHero({
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
  const t = await getTranslations("Dashboard");
  const tNav = await getTranslations("Nav");
  // balance already includes any reserved copy capital (allocated_amount is
  // a reservation on the same dollars, not separate money) -- only
  // unrealized P&L, not yet in balance until a position closes, is added.
  const totalValue = balance + totalUnrealizedPnl;
  const availableCash = Math.max(0, balance - totalAllocated);
  const pnlPct = balance > 0 ? (totalUnrealizedPnl / balance) * 100 : 0;
  const pnlPositive = totalUnrealizedPnl >= 0;
  const accountTypeShort = (v: AccountType) => (v === "real" ? t("accountTypeShortReal") : t("accountTypeShortDemo"));

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted">{t("portfolioValue")}</span>

        <div className="flex gap-1 rounded-lg border border-border bg-background p-0.5 text-xs" role="group" aria-label={t("accountTypeAriaLabel")}>
          {(["real", "demo"] as const).map((opt) =>
            opt === accountType ? (
              <span key={opt} className="rounded-md bg-accent px-3 py-1.5 font-medium text-accent-foreground">
                {accountTypeShort(opt)}
              </span>
            ) : (
              <form key={opt} action={chooseAccountType}>
                <input type="hidden" name="accountType" value={opt} />
                <input type="hidden" name="next" value="/dashboard" />
                <ConfirmButton
                  confirmText={tNav("switchAccountWarning")}
                  className="rounded-md px-3 py-1.5 text-muted transition hover:text-foreground"
                >
                  {accountTypeShort(opt)}
                </ConfirmButton>
              </form>
            ),
          )}
        </div>
      </div>

      <div>
        <p className="text-4xl font-bold tracking-tight">
          <span dir="ltr" className="inline-block">
            ${money(totalValue)}
          </span>
        </p>
        <p className="mt-1 text-sm">
          <span dir="ltr" className={`inline-block ${pnlPositive ? "text-success" : "text-danger"}`}>
            {pnlPositive ? "+" : "-"}${money(Math.abs(totalUnrealizedPnl))} ({pnlPositive ? "+" : "-"}
            {Math.abs(pnlPct).toFixed(2)}%)
          </span>
          <span className="ms-2 text-xs text-muted">{t("unrealizedPnl")}</span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
        <div>
          <p className="text-xs text-muted">{t("availableCash")}</p>
          <p className="mt-0.5 font-semibold">
            <span dir="ltr" className="inline-block">
              ${money(availableCash)}
            </span>
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">{t("reservedForCopy")}</p>
          <p className="mt-0.5 font-semibold">
            <span dir="ltr" className="inline-block">
              ${money(totalAllocated)}
            </span>
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
          {t("deposit")}
        </Link>
        <Link
          href="/portfolio/withdraw"
          className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-medium transition hover:border-accent/50"
        >
          <ActionIcon>
            <path d="M5 12l7-7 7 7" />
            <path d="M12 5v14" />
          </ActionIcon>
          {t("withdraw")}
        </Link>
        <Link
          href="/discover"
          className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-medium transition hover:border-accent/50"
        >
          <ActionIcon>
            <circle cx="12" cy="12" r="10" />
            <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
          </ActionIcon>
          {t("copy")}
        </Link>
      </div>
    </section>
  );
}
