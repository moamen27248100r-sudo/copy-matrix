"use client";

import { useState } from "react";

// The target-price field with quick steps from the current price (-5%, -2%, +2%, +5%), as on the
// alert sheets of the big platforms. The form posts to the createPriceAlert server action.
export function PriceAlertForm({
  action,
  symbol,
  price,
  decimals,
  labels,
}: {
  action: (formData: FormData) => void | Promise<void>;
  symbol: string;
  price: number;
  decimals: number;
  labels: { target: string; create: string };
}) {
  const round = (v: number) => Number(v.toFixed(decimals));
  const [value, setValue] = useState(String(round(price * 1.02)));
  const steps = [-5, -2, 2, 5];
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="symbol" value={symbol} />
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-muted">{labels.target}</span>
        <input
          name="target"
          inputMode="decimal"
          dir="ltr"
          required
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-11 rounded-xl border border-border bg-background px-3 text-base tabular-nums outline-none focus:border-accent"
        />
      </label>
      <div className="flex flex-wrap gap-2" dir="ltr">
        {steps.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setValue(String(round(price * (1 + s / 100))))}
            className="tap-44 rounded-full border border-border px-3 py-1 text-xs tabular-nums text-muted transition hover:border-accent/50 hover:text-foreground"
          >
            {s > 0 ? "+" : ""}
            {s}%
          </button>
        ))}
      </div>
      <button type="submit" className="h-11 rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground transition hover:bg-accent-hover">
        {labels.create}
      </button>
    </form>
  );
}
