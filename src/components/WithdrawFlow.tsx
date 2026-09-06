"use client";

import { useState } from "react";
import { requestWithdrawal } from "@/app/portfolio/actions";
import { DEPOSIT_NETWORKS, type DepositNetwork } from "@/lib/deposit-networks";

function AmountStep({
  amount,
  setAmount,
  maxAvailable,
  buttonLabel,
  onContinue,
}: {
  amount: string;
  setAmount: (v: string) => void;
  maxAvailable: number;
  buttonLabel: string;
  onContinue?: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col gap-8">
      <p className="text-sm text-muted">أدخل مبلغ السحب</p>

      <div className="flex items-center gap-3">
        <span className="shrink-0 text-lg font-semibold text-muted">USD</span>
        <div className="flex-1 rounded-lg border border-border bg-surface px-4 py-3">
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
        </div>
      </div>
      <p className="text-xs text-muted" dir="ltr">
        Max {maxAvailable.toFixed(6)} USD
      </p>

      <div className="mt-auto">
        <button
          type={onContinue ? "button" : "submit"}
          onClick={onContinue}
          disabled={!amount || Number(amount) <= 0 || Number(amount) > maxAvailable}
          className="w-full rounded-lg bg-warning px-4 py-3 text-center text-sm font-semibold text-background transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}

export function WithdrawFlow({ accountType, maxAvailable }: { accountType: "real" | "demo"; maxAvailable: number }) {
  const [amount, setAmount] = useState(maxAvailable > 0 ? maxAvailable.toFixed(2) : "");
  const [step, setStep] = useState<"amount" | "destination">("amount");
  const [network, setNetwork] = useState<DepositNetwork | null>(null);
  const [walletAddress, setWalletAddress] = useState("");

  if (accountType === "demo") {
    return (
      <form action={requestWithdrawal} className="flex flex-1 flex-col">
        <input type="hidden" name="amount" value={amount} />
        <AmountStep amount={amount} setAmount={setAmount} maxAvailable={maxAvailable} buttonLabel="متابعة" />
      </form>
    );
  }

  if (step === "amount") {
    return (
      <div className="flex flex-1 flex-col">
        <AmountStep
          amount={amount}
          setAmount={setAmount}
          maxAvailable={maxAvailable}
          buttonLabel="متابعة"
          onContinue={() => setStep("destination")}
        />
      </div>
    );
  }

  return (
    <form action={requestWithdrawal} className="flex flex-1 flex-col gap-4">
      <input type="hidden" name="amount" value={amount} />
      {network && <input type="hidden" name="network" value={network.id} />}

      <button
        type="button"
        onClick={() => setStep("amount")}
        className="flex w-fit items-center gap-1 text-xs text-muted hover:text-foreground"
      >
        → رجوع لتعديل المبلغ
      </button>

      <p className="text-sm text-muted">اختر الشبكة</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {DEPOSIT_NETWORKS.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => setNetwork(n)}
            className={
              network?.id === n.id
                ? "flex flex-col items-center gap-1 rounded-lg border border-accent bg-accent/10 px-3 py-3 text-center"
                : "flex flex-col items-center gap-1 rounded-lg border border-border bg-surface px-3 py-3 text-center transition hover:border-accent"
            }
          >
            <span className="text-sm font-medium text-foreground">{n.currency}</span>
            <span className="text-[11px] text-muted">{n.network}</span>
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-1 text-sm">
        عنوان المحفظة
        <input
          name="walletAddress"
          type="text"
          value={walletAddress}
          onChange={(e) => setWalletAddress(e.target.value)}
          placeholder="أدخل عنوان محفظتك على الشبكة المختارة"
          dir="ltr"
          required
          className="rounded border border-border bg-surface px-3 py-2 text-sm text-foreground"
        />
      </label>

      <div className="mt-auto">
        <button
          type="submit"
          disabled={!network || !walletAddress.trim()}
          className="w-full rounded-lg bg-warning px-4 py-3 text-center text-sm font-semibold text-background transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          تأكيد السحب
        </button>
      </div>
    </form>
  );
}
