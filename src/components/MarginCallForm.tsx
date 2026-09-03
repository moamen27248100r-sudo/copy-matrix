"use client";

import { useState } from "react";
import { addMarginCallTrade } from "@/app/admin/actions";
import { symbolFullName } from "@/lib/symbol-icons";

type ProviderOption = { id: string; display_name: string };

export function MarginCallForm({
  followerId,
  balance,
  followedProviders,
  symbols,
}: {
  followerId: string;
  balance: number;
  followedProviders: ProviderOption[];
  symbols: string[];
}) {
  const [lossAmount, setLossAmount] = useState(-100);

  if (followedProviders.length === 0) {
    return <p className="mt-4 text-sm text-muted">العميل ده مش بيتابع أي متداول حاليًا، فمفيش صفقة نسخ يتحطلها خسارة.</p>;
  }

  const targetLoss = Math.min(Math.abs(lossAmount), balance);
  const balanceAfter = balance - targetLoss;

  return (
    <form action={addMarginCallTrade} className="mt-4 flex flex-col gap-3">
      <input type="hidden" name="followerId" value={followerId} />

      <select
        name="providerId"
        required
        defaultValue={followedProviders[0].id}
        className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
      >
        {followedProviders.map((pr) => (
          <option key={pr.id} value={pr.id}>
            {pr.display_name}
          </option>
        ))}
      </select>

      <select name="symbol" required className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground">
        {symbols.map((sym) => (
          <option key={sym} value={sym}>
            {sym} — {symbolFullName(sym)}
          </option>
        ))}
      </select>

      <label className="flex flex-col gap-1 text-xs text-muted">
        قيمة الخسارة $ (اكتب رقم سالب، مثلًا -100)
        <input
          name="lossAmount"
          type="number"
          step="any"
          max={-1}
          required
          value={lossAmount}
          onChange={(e) => setLossAmount(Number(e.target.value) || 0)}
          className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
        />
      </label>

      <p className="rounded border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
        هتنزل خسارة ${targetLoss.toLocaleString("en-US", { maximumFractionDigits: 2 })} — الرصيد بعدها هيبقى $
        {balanceAfter.toLocaleString("en-US", { maximumFractionDigits: 2 })} (كان ${balance.toLocaleString("en-US", { maximumFractionDigits: 2 })})
      </p>

      <button
        type="submit"
        className="w-fit rounded bg-danger px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
      >
        تنفيذ صفقة الخسارة
      </button>
    </form>
  );
}
