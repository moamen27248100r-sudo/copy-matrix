"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

export const HISTORY_PERIODS = ["today", "week", "month", "threeMonths", "sixMonths", "year", "all"] as const;
export type HistoryPeriod = (typeof HISTORY_PERIODS)[number] | "custom";
export type CustomRange = { from: string; to: string };

const LABEL_KEYS: Record<(typeof HISTORY_PERIODS)[number], string> = {
  today: "periodToday",
  week: "periodWeek",
  month: "periodMonth",
  threeMonths: "periodThreeMonths",
  sixMonths: "periodSixMonths",
  year: "periodYear",
  all: "periodAll",
};

export function periodLabelKey(period: (typeof HISTORY_PERIODS)[number]) {
  return LABEL_KEYS[period];
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-accent-hover" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5 10 17.5 19 7" />
    </svg>
  );
}

// MT5-style bottom sheet: symbol filter on top, then one grouped, rounded
// list of periods with a blue check on the selected one. "Custom" expands a
// from / to date picker inline.
export function HistoryPeriodSheet({
  open,
  onClose,
  period,
  custom,
  symbol,
  symbols,
  onSelectPeriod,
  onApplyCustom,
  onSelectSymbol,
}: {
  open: boolean;
  onClose: () => void;
  period: HistoryPeriod;
  custom: CustomRange | null;
  symbol: string;
  symbols: string[];
  onSelectPeriod: (p: (typeof HISTORY_PERIODS)[number]) => void;
  onApplyCustom: (range: CustomRange) => void;
  onSelectSymbol: (s: string) => void;
}) {
  const t = useTranslations("TraderHistory");
  const tp = useTranslations("TradeHistory");
  const [customOpen, setCustomOpen] = useState(period === "custom");
  const [from, setFrom] = useState(custom?.from ?? "");
  const [to, setTo] = useState(custom?.to ?? "");
  const [invalid, setInvalid] = useState(false);
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useBodyScrollLock(open);

  // Mount on open, slide in on the next frame; slide out, then unmount.
  if (open && !mounted) setMounted(true);
  if (!open && shown) setShown(false);
  useEffect(() => {
    if (open) {
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(raf);
    }
    const timer = setTimeout(() => setMounted(false), 250);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  const applyCustom = () => {
    if (!from || !to || from > to) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onApplyCustom({ from, to });
  };

  return (
    <div className="fixed inset-0 z-[10000]">
      <div
        className={`absolute inset-0 bg-black/60 transition-opacity duration-200 motion-reduce:transition-none ${shown ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("sheetTitle")}
        tabIndex={-1}
        className={`absolute inset-x-0 bottom-0 mx-auto flex max-h-[88dvh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-3xl border border-b-0 border-white/[0.08] bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] shadow-2xl shadow-black/60 outline-none transition-transform duration-250 ease-out motion-reduce:transition-none sm:bottom-auto sm:top-1/2 sm:max-h-[80dvh] sm:rounded-3xl sm:border sm:pb-4 ${
          shown ? "translate-y-0 sm:-translate-y-1/2" : "translate-y-full sm:-translate-y-[40%] sm:opacity-0"
        }`}
      >
        <div className="mx-auto h-1 w-10 shrink-0 rounded-full bg-white/20 sm:hidden" aria-hidden="true" />
        <div className="flex items-center justify-between">
          <p className="text-base font-semibold">{t("sheetTitle")}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-muted transition hover:text-foreground"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Symbol filter */}
        <label className="flex items-center justify-between gap-3 rounded-2xl bg-surface px-4 py-3">
          <span className="text-sm text-muted">{t("symbolLabel")}</span>
          <select
            value={symbol}
            onChange={(e) => onSelectSymbol(e.target.value)}
            dir="ltr"
            className="min-w-0 max-w-[60%] cursor-pointer appearance-none truncate bg-transparent text-end text-sm font-medium text-accent-hover outline-none"
          >
            <option value="">{t("allSymbols")}</option>
            {symbols.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        {/* Periods */}
        <div className="overflow-hidden rounded-2xl bg-surface">
          {HISTORY_PERIODS.map((key, i) => (
            <button
              key={key}
              type="button"
              onClick={() => onSelectPeriod(key)}
              aria-pressed={period === key}
              className={`flex w-full items-center justify-between px-4 py-3.5 text-start text-[15px] transition hover:bg-white/[0.04] ${
                i > 0 ? "border-t border-white/[0.06]" : ""
              }`}
            >
              <span>{tp(LABEL_KEYS[key])}</span>
              {period === key && <CheckIcon />}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCustomOpen((v) => !v)}
            aria-expanded={customOpen}
            className="flex w-full items-center justify-between border-t border-white/[0.06] px-4 py-3.5 text-start text-[15px] transition hover:bg-white/[0.04]"
          >
            <span>{t("custom")}</span>
            <span className="flex items-center gap-2">
              {period === "custom" && <CheckIcon />}
              <svg
                viewBox="0 0 24 24"
                className={`h-4 w-4 text-muted transition-transform duration-200 motion-reduce:transition-none ${customOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </span>
          </button>
          <div className={`grid transition-[grid-template-rows] duration-250 ease-out motion-reduce:transition-none ${customOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
            <div className="overflow-hidden">
              <div className="flex flex-col gap-3 border-t border-white/[0.06] p-4">
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1 text-xs text-muted">
                    {t("from")}
                    <input
                      type="date"
                      value={from}
                      max={to || undefined}
                      onChange={(e) => setFrom(e.target.value)}
                      dir="ltr"
                      tabIndex={customOpen ? 0 : -1}
                      className="min-w-0 rounded-lg border border-white/[0.08] bg-background px-2.5 py-2 text-sm text-foreground [color-scheme:dark]"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-muted">
                    {t("to")}
                    <input
                      type="date"
                      value={to}
                      min={from || undefined}
                      onChange={(e) => setTo(e.target.value)}
                      dir="ltr"
                      tabIndex={customOpen ? 0 : -1}
                      className="min-w-0 rounded-lg border border-white/[0.08] bg-background px-2.5 py-2 text-sm text-foreground [color-scheme:dark]"
                    />
                  </label>
                </div>
                {invalid && <p className="text-xs text-danger">{t("invalidRange")}</p>}
                <button
                  type="button"
                  onClick={applyCustom}
                  tabIndex={customOpen ? 0 : -1}
                  className="rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-foreground transition hover:bg-accent-hover"
                >
                  {t("apply")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
