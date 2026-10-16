"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { CURRENCY } from "@/lib/money";
import { SubmitButton } from "@/components/SubmitButton";
import { demoDeposit } from "@/app/portfolio/actions";
import { IdempotencyField } from "@/components/IdempotencyField";

const MIN = 1;
const MAX = 1_000_000;

const QUICK = [100, 500, 1000, 5000];

export function SimpleDepositForm({ balance }: { balance: number }) {
  const t = useTranslations("Portfolio");
  const td = useTranslations("Dashboard");
  const [amount, setAmount] = useState("");
  const value = Number(amount);
  const decimalsOver = /\.\d{3,}/.test(amount);
  const problem = amount === "" ? null : decimalsOver ? "decimals" : value < MIN ? "min" : value > MAX ? "max" : null;
  const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <form action={demoDeposit} className="flex flex-1 flex-col gap-6">
      <IdempotencyField />
      <p className="text-sm text-muted">{t("enterDepositAmount")}</p>

      <div className="flex items-center gap-3">
        <span className="shrink-0 text-lg font-bold text-muted">{CURRENCY}</span>
        <div className="flex-1 rounded-lg border border-border bg-surface px-4 py-3">
          <input
            name="amount"
            type="text"
            inputMode="decimal"
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder="0"
            className="w-full bg-transparent text-right text-2xl font-bold text-foreground outline-none"
            dir="ltr"
          />
        </div>
      </div>

      <p aria-live="polite" className="-mt-4 min-h-0 text-sm text-danger">
        {problem === "decimals" ? t("amountDecimalsError") : problem === "min" ? t("amountMinError", { min: MIN }) : problem === "max" ? t("amountMaxError", { max: MAX.toLocaleString("en-US") }) : ""}
      </p>
      <div className="flex flex-wrap gap-2" dir="ltr">
        {QUICK.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setAmount(String(q))}
            aria-pressed={value === q}
            className={`tap-44 rounded-full px-4 py-1.5 text-sm tabular-nums transition ${value === q ? "bg-accent text-accent-foreground" : "border border-border text-muted hover:text-foreground"}`}
          >
            {q.toLocaleString("en-US")}
          </button>
        ))}
      </div>

      <dl className="flex items-center justify-between rounded-xl bg-surface px-4 py-3 text-sm">
        <dt className="text-muted">{t("balanceAfterDeposit")}</dt>
        <dd className="font-bold tabular-nums" dir="ltr">
          {fmt(balance + (Number.isFinite(value) && value > 0 ? value : 0))} {CURRENCY}
        </dd>
      </dl>

      <div className="mt-auto">
        <SubmitButton disabled={!amount || value <= 0 || !!problem} className="w-full rounded-lg bg-accent px-4 py-3 text-center text-sm font-bold text-accent-foreground transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50">
          {td("deposit")}
        </SubmitButton>
      </div>
    </form>
  );
}
