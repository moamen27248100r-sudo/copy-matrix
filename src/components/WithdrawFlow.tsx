"use client";

import { useMoney } from "@/lib/money-client";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { demoWithdraw } from "@/app/portfolio/actions";
import { CURRENCY } from "@/lib/money";
import { SubmitButton } from "@/components/SubmitButton";

// "1000.000000" reads as noise — show whole numbers plain ("1000") and
// only keep decimals when the amount actually has cents ("1000.5").
function formatAmount(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function AmountStep({
  amount,
  setAmount,
  maxAvailable,
  buttonLabel,
}: {
  amount: string;
  setAmount: (v: string) => void;
  maxAvailable: number;
  buttonLabel: string;
}) {
  const t = useTranslations("Portfolio");
  const money = useMoney();
  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-md">
        <p className="text-xs text-muted">{t("availableToWithdraw")}</p>
        <p className="mt-1 text-xl font-bold text-foreground" dir="ltr">
          {money(maxAvailable)}
        </p>
      </div>

      <p className="text-sm text-muted">{t("enterWithdrawAmount")}</p>

      <div className="flex items-center gap-2">
        <span className="shrink-0 text-lg font-semibold text-muted">{CURRENCY}</span>
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 backdrop-blur-md">
          <input
            type="text"
            inputMode="decimal"
            autoFocus
            value={amount}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d.]/g, "");
              setAmount(v);
            }}
            className="w-full bg-transparent text-right text-2xl font-semibold text-foreground outline-none"
            dir="ltr"
          />
          <button
            type="button"
            onClick={() => setAmount(formatAmount(maxAvailable))}
            className="shrink-0 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-bold text-accent transition hover:bg-accent/20"
          >
            {t("maxButton")}
          </button>
        </div>
      </div>

      <div className="mt-auto">
        <SubmitButton disabled={!amount || Number(amount) <= 0 || Number(amount) > maxAvailable} className="w-full rounded-xl bg-gradient-to-r from-accent to-brand px-4 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-accent/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
          {buttonLabel}
        </SubmitButton>
      </div>
    </div>
  );
}

// Demo account withdrawal: instant, virtual funds only (real withdrawals use wallet/WithdrawForm).
export function WithdrawFlow({ maxAvailable }: { maxAvailable: number }) {
  const t = useTranslations("Portfolio");
  const [amount, setAmount] = useState(maxAvailable > 0 ? formatAmount(maxAvailable) : "");
  return (
    <form action={demoWithdraw} className="flex flex-1 flex-col">
      <input type="hidden" name="amount" value={amount} />
      <AmountStep amount={amount} setAmount={setAmount} maxAvailable={maxAvailable} buttonLabel={t("confirmWithdraw")} />
    </form>
  );
}
