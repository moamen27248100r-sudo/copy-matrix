"use client";

import { useState } from "react";
import { addMarginCallTrade } from "@/app/admin/actions";
import { symbolFullName } from "@/lib/symbol-icons";

type ProviderOption = { id: string; display_name: string };

export function MarginCallForm({
  followerId,
  balance,
  followedProviders,
  otherProviders,
  symbols,
}: {
  followerId: string;
  balance: number;
  followedProviders: ProviderOption[];
  otherProviders: ProviderOption[];
  symbols: string[];
}) {
  const [pips, setPips] = useState(50);
  const [lossPercent, setLossPercent] = useState(100);

  const targetLoss = balance * (lossPercent / 100);

  return (
    <form action={addMarginCallTrade} className="mt-4 flex flex-col gap-3">
      <input type="hidden" name="followerId" value={followerId} />
      <select
        name="providerId"
        required
        defaultValue={followedProviders[0]?.id ?? ""}
        className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
      >
        <option value="">اختر المتداول المنسوب له</option>
        {followedProviders.length > 0 && (
          <optgroup label="المتداولون اللي بيتابعهم العميل حاليًا">
            {followedProviders.map((pr) => (
              <option key={pr.id} value={pr.id}>
                {pr.display_name}
              </option>
            ))}
          </optgroup>
        )}
        <optgroup label="كل المتداولين">
          {otherProviders.map((pr) => (
            <option key={pr.id} value={pr.id}>
              {pr.display_name}
            </option>
          ))}
        </optgroup>
      </select>

      <select name="symbol" required className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground">
        {symbols.map((sym) => (
          <option key={sym} value={sym}>
            {sym} — {symbolFullName(sym)}
          </option>
        ))}
      </select>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-muted">
          عدد النقاط (Pips)
          <input
            name="pips"
            type="number"
            step="any"
            min={1}
            required
            value={pips}
            onChange={(e) => setPips(Number(e.target.value) || 0)}
            list="pips-presets"
            className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
          <datalist id="pips-presets">
            <option value={50} />
            <option value={80} />
            <option value={100} />
            <option value={230} />
          </datalist>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          نسبة الخسارة من رصيده %
          <input
            name="lossPercent"
            type="number"
            step="any"
            min={1}
            max={100}
            required
            value={lossPercent}
            onChange={(e) => setLossPercent(Number(e.target.value) || 0)}
            className="rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
      </div>

      <p className="rounded border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
        الخسارة المستهدفة: ${targetLoss.toLocaleString("en-US", { maximumFractionDigits: 2 })} من رصيد حالي قدره $
        {balance.toLocaleString("en-US", { maximumFractionDigits: 2 })}
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
