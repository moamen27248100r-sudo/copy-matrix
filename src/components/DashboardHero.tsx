import Link from "next/link";
import { formatPct, profitPct } from "@/lib/profit-pct";
import { getTranslations } from "next-intl/server";
import { ConfirmButton } from "@/components/ConfirmButton";
import { MyEquityChart } from "@/components/MyEquityChart";
import { CountUp } from "@/components/ui/CountUp";
import { getMoney } from "@/lib/money-server";
import type { MoneyOptions } from "@/lib/money";
import { resetDemoBalance } from "@/app/portfolio/actions";

type AccountType = "real" | "demo";

type Money = (value: number, opts?: MoneyOptions) => string;

function ActionIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

// A label with its figure directly beneath it, aligned to the start edge in both directions.
const pctText = (v: number | null) => formatPct(v);

function ProfitStat({ label, amount, pct, money }: { label: string; amount: number; pct: number | null; money: Money }) {
  const positive = amount >= 0;
  return (
    <div className="min-w-0 text-start">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">
        <span dir="ltr" className={`inline-block ${positive ? "text-success" : "text-danger"}`}>
          {money(amount, { signed: true })} {pct != null ? `(${pctText(pct)})` : ""}
        </span>
      </p>
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
  depositsOn,
  balance,
  totalAllocated,
  totalUnrealizedPnl,
  totalRealizedPnl,
  todayPnl,
  closedPositions,
  netInvested,
}: {
  accountType: AccountType;
  /** Deposits switched on (platform setting); a real account sees no deposit button while off. */
  depositsOn: boolean;
  balance: number;
  totalAllocated: number;
  totalUnrealizedPnl: number;
  totalRealizedPnl: number;
  todayPnl: number;
  closedPositions: { pnl: number | null; closed_at: string | null }[];
  /** Net invested funds (see lib/profit-pct.ts); null when unknown. */
  netInvested: number | null;
}) {
  const money = await getMoney();
  const t = await getTranslations("Dashboard");
  // balance already includes any reserved copy capital (allocated_amount is
  // a reservation on the same dollars, not separate money) -- only
  // unrealized P&L, not yet in balance until a position closes, is added.
  const totalValue = balance + totalUnrealizedPnl;
  const availableCash = Math.max(0, balance - totalAllocated);
  const pnlPct = profitPct(totalUnrealizedPnl, netInvested);
  const pnlPositive = totalUnrealizedPnl >= 0;
  const totalProfit = totalRealizedPnl + totalUnrealizedPnl;
  const totalProfitPct = profitPct(totalProfit, netInvested);
  const todayPct = profitPct(todayPnl, netInvested);

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted">{t("portfolioValue")}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="font-display text-4xl font-extrabold tracking-tight" dir="ltr">
          <span dir="ltr" className="inline-block">
            <CountUp value={totalValue} money />
          </span>
        </p>
        <div className="mt-1 grid grid-cols-2 gap-3">
          <ProfitStat label={t("todayProfit")} amount={todayPnl} pct={todayPct} money={money} />
          <ProfitStat label={t("totalProfit")} amount={totalProfit} pct={totalProfitPct} money={money} />
        </div>
        <p className="text-start text-xs text-muted">
          {t("unrealizedPnl")}{" "}
          <span dir="ltr" className={`inline-block ${pnlPositive ? "text-success" : "text-danger"}`}>
            {money(totalUnrealizedPnl, { signed: true })} {pnlPct != null ? `(${pctText(pnlPct)})` : ""}
          </span>
        </p>
      </div>

      <MyEquityChart positions={closedPositions} netInvested={netInvested} />

      <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
        <div>
          <p className="text-xs text-muted">{t("availableCash")}</p>
          <p className="mt-0.5 font-semibold">
            <span dir="ltr" className="inline-block">
              {money(availableCash)}
            </span>
          </p>
        </div>
        <div>
          <p className="text-xs text-muted">{t("reservedForCopy")}</p>
          <p className="mt-0.5 font-semibold">
            <span dir="ltr" className="inline-block">
              {money(totalAllocated)}
            </span>
          </p>
        </div>
      </div>

      {accountType === "real" ? (
        <div className={`grid gap-2 ${depositsOn ? "grid-cols-3" : "grid-cols-2"}`}>
          {depositsOn && (
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
          )}
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
        <div className="grid grid-cols-2 gap-2">
          <form action={resetDemoBalance}>
            <input type="hidden" name="returnTo" value="/dashboard" />
            <ConfirmButton
              confirmText={t("resetBalanceConfirm")}
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
        </div>
      )}
    </section>
  );
}
