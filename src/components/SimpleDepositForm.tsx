"use client";

import { useState } from "react";
import { requestDeposit } from "@/app/portfolio/actions";

export function SimpleDepositForm() {
  const [amount, setAmount] = useState("");

  return (
    <form action={requestDeposit} className="flex flex-1 flex-col gap-8">
      <p className="text-sm text-muted">أدخل مبلغ الإيداع</p>

      <div className="flex items-center gap-3">
        <span className="shrink-0 text-lg font-semibold text-muted">USD</span>
        <div className="flex-1 rounded-lg border border-border bg-surface px-4 py-3">
          <input
            name="amount"
            type="text"
            inputMode="decimal"
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder="0"
            className="w-full bg-transparent text-right text-2xl font-semibold text-foreground outline-none"
            dir="ltr"
          />
        </div>
      </div>

      <div className="mt-auto">
        <button
          type="submit"
          disabled={!amount || Number(amount) <= 0}
          className="w-full rounded-lg bg-accent px-4 py-3 text-center text-sm font-semibold text-accent-foreground transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          إيداع
        </button>
      </div>
    </form>
  );
}
