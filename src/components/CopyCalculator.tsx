"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { DailySeries } from "@/components/TraderEquityChart";
import { formatMoney } from "@/lib/money";
import type { Locale } from "@/i18n/locales";

// "If you had copied": an amount and a start (1, 3, 6 or 12 months ago, or the whole record) applied
// to the leader's actual daily results. A copy follows the leader in proportion to the amount (the
// copy rule of the platform), so the copy grows by the same compounded daily returns. The profit
// share is taken on the profit at the end; the lowest point is the deepest fall of the copy below
// its own earlier high on the way.
const STARTS = [
  { key: "m1", days: 30 },
  { key: "m3", days: 91 },
  { key: "m6", days: 182 },
  { key: "y1", days: 365 },
  { key: "all", days: null },
] as const;

export function CopyCalculator({
  daily,
  defaultAmount,
  minAmount,
  profitSharePct,
  locale,
}: {
  daily: DailySeries | null;
  defaultAmount: number;
  minAmount: number;
  profitSharePct: number | null;
  locale: Locale;
}) {
  const t = useTranslations("CopyCalculator");
  const [amountText, setAmountText] = useState(String(defaultAmount));
  const [start, setStart] = useState<(typeof STARTS)[number]["key"]>("m3");
  const n = daily?.days.length ?? 0;
  const amount = Number(amountText.replace(/,/g, ""));
  const fmt = (v: number) => formatMoney(v, locale);
  const available = STARTS.filter((s) => s.days == null || n >= Math.min(s.days, 30));

  const result = useMemo(() => {
    if (!daily || n === 0 || !Number.isFinite(amount) || amount <= 0) return null;
    const s = STARTS.find((x) => x.key === start)!;
    const from = s.days == null ? 0 : Math.max(0, n - s.days);
    let index = 1;
    let peak = 1;
    let worst = 0;
    for (let i = from; i < n; i++) {
      index *= 1 + Number(daily.ret[i] ?? 0);
      peak = Math.max(peak, index);
      worst = Math.min(worst, index / peak - 1);
    }
    const gross = amount * index;
    const profit = gross - amount;
    const fee = profit > 0 && profitSharePct ? (profit * profitSharePct) / 100 : 0;
    return { value: gross - fee, profit: profit - fee, pct: ((gross - fee) / amount - 1) * 100, fee, worst: worst * 100, since: daily.days[from] };
  }, [daily, n, amount, start, profitSharePct]);

  if (!daily || n < 30) return null;
  const tooSmall = Number.isFinite(amount) && amount > 0 && amount < minAmount;

  return (
    <section className="flex flex-col gap-4 rounded-[20px] border border-border bg-surface p-5">
      <div>
        <h2 className="text-section-title">{t("title")}</h2>
        <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-xs text-muted">{t("amount")}</span>
          <input
            inputMode="decimal"
            dir="ltr"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            className="h-11 rounded-xl border border-border bg-background px-3 text-base tabular-nums outline-none focus:border-accent"
          />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-muted">{t("since")}</span>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("since")}>
            {available.map((s) => (
              <button
                key={s.key}
                type="button"
                aria-pressed={start === s.key}
                onClick={() => setStart(s.key)}
                className={`tap-44 rounded-full px-3 py-1.5 text-xs transition ${start === s.key ? "bg-accent text-accent-foreground" : "border border-border text-muted hover:text-foreground"}`}
              >
                {t(`start_${s.key}`)}
              </button>
            ))}
          </div>
        </div>
      </div>
      {tooSmall && <p className="text-xs text-warning">{t("belowMin", { min: "⁦" + fmt(minAmount) + "⁩" })}</p>}
      {result && (
        <dl className="grid grid-cols-2 gap-3 rounded-xl bg-background/60 p-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted">{t("valueNow")}</dt>
            <dd className="text-lg font-bold tabular-nums" dir="ltr">
              {fmt(result.value)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{t("result")}</dt>
            <dd className={`text-lg font-bold tabular-nums ${result.profit >= 0 ? "text-success" : "text-danger"}`} dir="ltr">
              {result.profit >= 0 ? "+" : "-"}
              {fmt(Math.abs(result.profit))} ({result.pct >= 0 ? "+" : ""}
              {result.pct.toFixed(2)}%)
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{t("lowestPoint")}</dt>
            <dd className="text-lg font-bold tabular-nums text-danger" dir="ltr">
              {result.worst.toFixed(2)}%
            </dd>
          </div>
        </dl>
      )}
      <p className="text-xs leading-relaxed text-muted">
        {profitSharePct ? t("noteWithShare", { pct: profitSharePct }) : t("note")} {t("pastPerformance")}
      </p>
    </section>
  );
}
