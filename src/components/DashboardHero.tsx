import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AccountTypeSwitcher } from "@/components/AccountTypeSwitcher";
import { ConfirmButton } from "@/components/ConfirmButton";
import { MyEquityChart } from "@/components/MyEquityChart";
import { chooseAccountType } from "@/app/auth/actions";

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

function ProfitRow({ label, amount, pct }: { label: string; amount: number; pct: number }) {
  const positive = amount >= 0;
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span dir="ltr" className={positive ? "text-success" : "text-danger"}>
        {positive ? "+" : "-"}${money(Math.abs(amount))} ({positive ? "+" : "-"}
        {Math.abs(pct).toFixed(2)}%)
      </span>
    </div>
  );
}

// One consolidated balance card for the customer dashboard: total value,
// today's/total profit, a mini equity chart with period buttons, the
// account switch, the cash / reserved breakdown, and account-type-specific
// actions -- replacing what used to be several separate cards/sections
// that repeated the same balance and pushed the equity chart to its own
// section further down the page.
export async function DashboardHero({
  accountType,
  balance,
  totalAllocated,
  totalUnrealizedPnl,
  totalRealizedPnl,
  todayPnl,
  closedPositions,
}: {
  accountType: AccountType;
  balance: number;
  totalAllocated: number;
  totalUnrealizedPnl: number;
  totalRealizedPnl: number;
  todayPnl: number;
  closedPositions: { pnl: number | null; closed_at: string | null }[];
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
  const totalProfit = totalRealizedPnl + totalUnrealizedPnl;
  const totalProfitPct = balance > 0 ? (totalProfit / balance) * 100 : 0;
  const todayPct = balance > 0 ? (todayPnl / balance) * 100 : 0;

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted">{t("portfolioValue")}</span>

        <AccountTypeSwitcher
          accountType={accountType}
          next="/dashboard"
          ariaLabel={t("accountTypeAriaLabel")}
          options={[
            { key: "real", label: accountTypeShort("real") },
            { key: "demo", label: accountTypeShort("demo") },
          ]}
          confirmTitle={t("switchAccountConfirmTitle")}
          confirmText={tNav("switchAccountWarning")}
          confirmCta={t("switchAccountConfirmCta")}
          cancelCta={t("switchAccountCancelCta")}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="font-display text-4xl font-extrabold tracking-tight" dir="ltr">
          <span dir="ltr" className="inline-block">
            ${money(totalValue)}
          </span>
        </p>
        <ProfitRow label={t("todayProfit")} amount={todayPnl} pct={todayPct} />
        <ProfitRow label={t("totalProfit")} amount={totalProfit} pct={totalProfitPct} />
        <p className="text-xs text-muted">
          <span dir="ltr" className={pnlPositive ? "text-success" : "text-danger"}>
            {pnlPositive ? "+" : "-"}${money(Math.abs(totalUnrealizedPnl))} ({pnlPositive ? "+" : "-"}
            {Math.abs(pnlPct).toFixed(2)}%)
          </span>{" "}
          {t("unrealizedPnl")}
        </p>
      </div>

      <MyEquityChart positions={closedPositions} />

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

      {accountType === "real" ? (
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
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <form action={chooseAccountType}>
            <input type="hidden" name="accountType" value="demo" />
            <input type="hidden" name="next" value="/dashboard" />
            <ConfirmButton
              confirmText={tNav("switchAccountWarning")}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-medium transition hover:border-accent/50"
            >
              <ActionIcon>
                <path d="M3 12a9 9 0 1 0 3-6.7" />
                <path d="M3 4v5h5" />
              </ActionIcon>
              {t("resetBalance")}
            </ConfirmButton>
          </form>
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
          <form action={chooseAccountType}>
            <input type="hidden" name="accountType" value="real" />
            <input type="hidden" name="next" value="/dashboard" />
            <ConfirmButton
              confirmText={tNav("switchAccountWarning")}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2.5 text-sm font-medium text-accent-foreground transition hover:bg-accent-hover"
            >
              <ActionIcon>
                <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
              </ActionIcon>
              {t("demoBannerAction")}
            </ConfirmButton>
          </form>
        </div>
      )}
    </section>
  );
}
