"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

// Copy-start dialog. Amount + risk acknowledgment are wired to the real
// followProvider action; copy mode and the advanced settings are shown
// disabled ("coming soon") until the backend supports them.
export function CopyDialog({
  action,
  providerId,
  providerName,
  defaultAmount,
  minAmount,
}: {
  action: (formData: FormData) => void | Promise<void>;
  providerId: string;
  providerName: string;
  defaultAmount: number;
  minAmount: number;
}) {
  const t = useTranslations("CopyDialog");
  const [open, setOpen] = useState(false);
  const [ack, setAck] = useState(false);
  const [advanced, setAdvanced] = useState(false);

  const soon = (
    <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
      {t("comingSoon")}
    </span>
  );

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
                className="rounded-lg border border-border bg-surface px-3 py-2.5 text-foreground focus:outline-none"
              />
              <span className="text-xs text-muted">
                {t("minAmount")} <span dir="ltr">${minAmount.toLocaleString("en-US")}</span>
              </span>
            </label>

            <fieldset className="flex flex-col gap-2" disabled>
              <legend className="flex w-full items-center justify-between pb-1 text-sm text-muted">
                {t("modeLabel")} {soon}
              </legend>
              <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm opacity-60">
                <input type="radio" name="mode" defaultChecked /> {t("modeRatio")}
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm opacity-60">
                <input type="radio" name="mode" /> {t("modeFixed")}
              </label>
              <label className="flex items-center gap-2 text-sm opacity-60">
                <input type="checkbox" /> {t("copyOpenTrades")}
              </label>
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
              {advanced && (
                <fieldset className="flex flex-col gap-2 px-3 pb-3" disabled>
                  <div className="flex justify-end">{soon}</div>
                  {(["maxPerTrade", "copyStopLoss", "trailingStop", "perTradeTpSl"] as const).map((k) => (
                    <label key={k} className="flex flex-col gap-1 text-xs text-muted">
                      {t(k)}
                      <input type="text" className="rounded border border-border bg-surface px-2 py-1.5 opacity-60" />
                    </label>
                  ))}
                </fieldset>
              )}
            </div>

            <label className="flex items-start gap-2 text-xs text-muted">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5" />
              <span>{t("riskAck")}</span>
            </label>

            <button
              type="submit"
              disabled={!ack}
              className="rounded-lg bg-accent px-6 py-3 text-base font-bold text-accent-foreground transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("confirm")}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
