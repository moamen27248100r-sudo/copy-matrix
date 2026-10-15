"use client";

import { useUsdt } from "@/lib/money-client";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { demoWithdraw } from "@/app/portfolio/actions";
import { CURRENCY } from "@/lib/money";
import { SubmitButton } from "@/components/SubmitButton";

// The "All" amount must never exceed the balance, or the form refuses its own
// value. Balances carry up to 6 decimals, so round DOWN at 6 (rounding to cents
// could land above the balance), and drop trailing zeros ("1000", not "1000.000000").
function formatAmount(n: number): string {
  return String(Math.floor(n * 1e6) / 1e6);
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
  const money = useUsdt();
  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md">
        <p className="text-xs text-muted">{t("availableToWithdraw")}</p>
        <p className="mt-1 text-xl font-bold text-foreground" dir="ltr">
          {money(maxAvailable)}
        </p>
      </div>

      <p className="text-sm text-muted">{t("enterWithdrawAmount")}</p>

      <div className="flex items-center gap-2">
        <span className="shrink-0 text-lg font-bold text-muted">{CURRENCY}</span>
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
            className="w-full bg-transparent text-right text-2xl font-bold text-foreground outline-none"
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
        <SubmitButton disabled={!amount || Number(amount) <= 0 || Number(amount) > maxAvailable} className="w-full rounded-xl bg-gradient-to-r from-accent to-brand px-4 py-3 text-center text-sm font-bold text-white shadow-lg shadow-accent/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
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
