import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getMoney } from "@/lib/money-server";
import { ConfirmButton } from "@/components/ConfirmButton";
import { CountUp } from "@/components/ui/CountUp";
import { MyEquityChart, type Benchmarks } from "@/components/MyEquityChart";
import { resetDemoBalance } from "@/app/portfolio/actions";

function Arrow({ down }: { down?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {down ? (
        <>
          <path d="M12 5v14" />
          <path d="M5 12l7 7 7-7" />
        </>
      ) : (
        <>
          <path d="M5 12l7-7 7 7" />
          <path d="M12 5v14" />
        </>
      )}
    </svg>
  );
}

// The wallet's balance card -- the one place the money is shown: the value (with "demo" next to it
// on a demo account), the result of the chosen period, the chart with its period bar, three equal
// tiles (cash / invested in copies / unrealized result) and, on a real account, deposit and withdraw.
// Resetting the demo balance is a quiet entry in the card's "..." menu.
export async function WalletCard({
  isDemo,
  depositsOn,
  totalValue,
  cash,
  invested,
  unrealized,
  series,
  netInvested,
  benchmarks,
  returnTo = "/portfolio",
}: {
  isDemo: boolean;
  depositsOn: boolean;
  totalValue: number;
  cash: number;
  invested: number;
  unrealized: number;
  series: { pnl: number | null; closed_at: string | null }[];
  netInvested: number | null;
  benchmarks: Benchmarks | null;
  returnTo?: string;
}) {
  const t = await getTranslations("Dashboard");
  const tp = await getTranslations("Portfolio");
  const money = await getMoney();

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-sm text-muted">{t("portfolioValue")}</span>
          {isDemo && (
            <span className="shrink-0 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
              {t("accountDemo")}
            </span>
          )}
        </div>
        {isDemo && (
          <details className="relative">
            <summary
              className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg text-muted transition hover:bg-white/5 hover:text-foreground [&::-webkit-details-marker]:hidden"
              aria-label={tp("walletMenuLabel")}
            >
              <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
            </summary>
            <div className="absolute end-0 top-9 z-10 min-w-48 rounded-xl border border-border bg-background p-1 shadow-xl">
              <form action={resetDemoBalance}>
                <input type="hidden" name="returnTo" value={returnTo} />
                <ConfirmButton
                  confirmText={tp("resetDemoConfirm")}
                  className="w-full rounded-lg px-3 py-2 text-start text-sm transition hover:bg-white/5"
                >
                  {tp("resetDemoButton")}
                </ConfirmButton>
              </form>
            </div>
          </details>
        )}
      </div>

      <p className="font-display text-4xl font-extrabold tracking-tight" dir="ltr">
        <span dir="ltr" className="inline-block">
          <CountUp value={totalValue} money />
        </span>
      </p>

      <MyEquityChart wallet positions={series} netInvested={netInvested} benchmarks={benchmarks} />

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: t("availableCash"), value: money(cash), tone: "" },
          { label: t("investedInCopies"), value: money(invested), tone: "" },
          { label: t("unrealizedPnl"), value: money(unrealized, { signed: true }), tone: unrealized >= 0 ? "text-success" : "text-danger" },
        ].map((tile) => (
          <div key={tile.label} className="flex flex-col items-center justify-center gap-1 rounded-xl border border-border bg-background px-2 py-3 text-center">
            <p className={`text-sm font-semibold tabular-nums ${tile.tone}`} dir="ltr">
              {tile.value}
            </p>
            <p className="text-[11px] leading-tight text-muted">{tile.label}</p>
          </div>
        ))}
      </div>

      {!isDemo && (
        <div className="grid grid-cols-2 gap-2">
          {depositsOn ? (
            <Link
              href="/portfolio/deposit"
              className="flex items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2.5 text-sm font-medium text-accent-foreground transition hover:bg-accent-hover"
            >
              <Arrow down />
              {t("deposit")}
            </Link>
          ) : (
            <span
              aria-disabled="true"
              className="flex flex-col items-center justify-center rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-muted"
            >
              <span className="flex items-center gap-1.5">
                <Arrow down />
                {t("deposit")}
              </span>
              <span className="text-[11px] font-normal">{tp("temporarilyUnavailable")}</span>
            </span>
          )}
          <Link
            href="/portfolio/withdraw"
            className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-medium transition hover:border-accent/50"
          >
            <Arrow />
            {t("withdraw")}
          </Link>
        </div>
      )}
    </section>
  );
}
