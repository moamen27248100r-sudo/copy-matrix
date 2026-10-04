"use client";

import { useMoney } from "@/lib/money-client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { SubmitButton } from "@/components/SubmitButton";

// Copy-start dialog. Every field is applied by the followProvider action and
// stored on the subscription: the copy mode and max-per-trade size each copied
// trade, and the stop-loss percentage is the loss at which the copy stops itself.
export function CopyDialog({
  action,
  providerId,
  providerName,
  defaultAmount,
  minAmount,
  profitSharePct,
}: {
  action: (formData: FormData) => void | Promise<void>;
  providerId: string;
  providerName: string;
  defaultAmount: number;
  minAmount: number;
  profitSharePct?: number | null;
}) {
  const t = useTranslations("CopyDialog");
  const money = useMoney();
  const [open, setOpen] = useState(false);
  const [ack, setAck] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [mode, setMode] = useState<"ratio" | "fixed">("ratio");

  const inputCls = "rounded-lg border border-border bg-surface px-3 py-2.5 text-foreground focus:outline-none";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-lg bg-accent px-6 py-3 text-base font-bold text-accent-foreground shadow-md shadow-accent/20 transition hover:bg-accent-hover"
      >
        {t("open")}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={() => setOpen(false)} aria-hidden="true" />
          <form
            action={action}
            className="relative z-10 flex max-h-[90vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-3xl border border-white/[0.08] bg-[#0B132B] p-5 shadow-2xl sm:rounded-3xl"
          >
            <input type="hidden" name="providerId" value={providerId} />
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">{t("title", { name: providerName })}</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label={t("close")} className="text-muted hover:text-foreground">
                ✕
              </button>
            </div>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-muted">{t("amountLabel")}</span>
              <input
                name="allocatedAmount"
                type="number"
                step="any"
                min={minAmount}
                defaultValue={defaultAmount}
                required
                className={inputCls}
              />
              <span className="text-xs text-muted">
                {t("minAmount")} <span dir="ltr">{money(minAmount)}</span>
              </span>
            </label>

            {profitSharePct != null && (
              <p className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted">
                {t("profitShare")} <span dir="ltr" className="font-semibold text-foreground">{profitSharePct}%</span>
              </p>
            )}

            <fieldset className="flex flex-col gap-2">
              <legend className="pb-1 text-sm text-muted">{t("modeLabel")}</legend>
              <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <input type="radio" name="mode" value="ratio" checked={mode === "ratio"} onChange={() => setMode("ratio")} /> {t("modeRatio")}
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <input type="radio" name="mode" value="fixed" checked={mode === "fixed"} onChange={() => setMode("fixed")} /> {t("modeFixed")}
              </label>
              {mode === "fixed" && (
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="text-muted">{t("fixedAmountLabel")}</span>
                  <input name="fixedAmount" type="number" step="any" min={1} max={defaultAmount} required className={inputCls} dir="ltr" />
                </label>
              )}
            </fieldset>

            <div className="flex flex-col gap-2 rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setAdvanced((v) => !v)}
                aria-expanded={advanced}
                className="flex items-center justify-between px-3 py-2 text-sm font-medium"
              >
                <span>{t("advanced")}</span>
                <span aria-hidden="true">{advanced ? "−" : "+"}</span>
              </button>
              <div className={advanced ? "flex flex-col gap-3 px-3 pb-3" : "hidden"}>
                <label className="flex flex-col gap-1 text-xs text-muted">
                  {t("maxPerTrade")}
                  <input name="maxPerTrade" type="number" step="any" min={1} className="rounded border border-border bg-surface px-2 py-1.5 text-sm text-foreground" dir="ltr" />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted">
                  {t("copyStopLoss")}
                  <input
                    name="stopLossPct"
                    type="number"
                    step="1"
                    min={1}
                    max={90}
                    defaultValue={50}
                    className="rounded border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
                    dir="ltr"
                  />
                  <span>{t("copyStopLossHint")}</span>
                </label>
                <p className="border-t border-border pt-3 text-xs font-semibold text-foreground">{t("tradeRiskTitle")}</p>
                <label className="flex flex-col gap-1 text-xs text-muted">
                  {t("takeProfitLabel")}
                  <input name="takeProfitPct" type="number" step="any" min={1} max={500} className="rounded border border-border bg-surface px-2 py-1.5 text-sm text-foreground" dir="ltr" />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted">
                  {t("stopLossLabel")}
                  <input name="tradeStopLossPct" type="number" step="any" min={1} max={90} className="rounded border border-border bg-surface px-2 py-1.5 text-sm text-foreground" dir="ltr" />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted">
                  {t("trailingLabel")}
                  <input name="trailingPct" type="number" step="any" min={0.5} max={50} className="rounded border border-border bg-surface px-2 py-1.5 text-sm text-foreground" dir="ltr" />
                  <span>{t("trailingHint")}</span>
                </label>
                <span className="text-xs text-muted">{t("tpslHint")}</span>
                <label className="flex items-start gap-2 border-t border-border pt-3 text-xs text-muted">
                  <input type="checkbox" name="copyOpen" className="mt-0.5" />
                  <span>
                    {t("copyOpenLabel")}
                    <span className="block">{t("copyOpenHint")}</span>
                  </span>
                </label>
              </div>
            </div>

            <label className="flex items-start gap-2 text-xs text-muted">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5" />
              <span>{t("riskAck")}</span>
            </label>

            <SubmitButton disabled={!ack} className="rounded-lg bg-accent px-6 py-3 text-base font-bold text-accent-foreground transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50">
              {t("confirm")}
            </SubmitButton>
          </form>
        </div>
      )}
    </>
  );
}
