"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useOnScreen } from "@/components/landing/useInView";

const FILL_MS = 6000;
const HOLD_MS = 2600;
const TICK = 100;

// Animated copy-settings window: the "current loss" bar fills up to 50%
// (transform only), then "copying stopped automatically" appears, then it restarts.
export function ProtectionDemo() {
  const t = useTranslations("Landing");
  const { ref, visible, reduced } = useOnScreen<HTMLDivElement>();
  const [ms, setMs] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => setMs((m) => (m + TICK) % (FILL_MS + HOLD_MS)), TICK);
    return () => clearInterval(id);
  }, [visible]);

  const progress = reduced ? 1 : Math.min(1, ms / FILL_MS);
  const stopped = progress >= 1;
  const loss = progress * 50;
  const row = "flex items-center justify-between gap-4 border-b border-border py-3 text-sm";

  return (
    <div ref={ref} className="mx-auto w-full max-w-[420px]">
      <div className="rounded-2xl border border-border bg-surface p-5">
        <p className="mb-2 text-base font-semibold">{t("mockTitle")}</p>
        <div className={row}>
          <span className="text-muted">{t("mockAmount")}</span>
          <span className="num font-medium">$1,000</span>
        </div>
        <div className={row}>
          <span className="text-muted">{t("mockLossLimit")}</span>
          <span className="num font-medium">50%</span>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">{t("lossNow")}</span>
            <span className="num font-medium text-down">-{loss.toFixed(1)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full origin-left rounded-full bg-down will-change-transform rtl:origin-right"
              style={{ transform: `scaleX(${progress})`, transition: reduced ? "none" : `transform ${TICK}ms linear` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted" dir="ltr">
            <span className="num">0%</span>
            <span className="num">50%</span>
          </div>
        </div>

        <div className="relative mt-4 h-10">
          <div
            className="absolute inset-0 flex items-center justify-center rounded-xl border border-border-strong text-sm text-muted"
            style={{ opacity: stopped ? 0 : 1, transition: "opacity 300ms" }}
          >
            {t("mockStop")}
          </div>
          <div
            className="absolute inset-0 flex items-center justify-center rounded-xl border border-down bg-surface-2 text-sm font-medium"
            style={{ opacity: stopped ? 1 : 0, transform: `translateY(${stopped ? 0 : 6}px)`, transition: "opacity 300ms, transform 300ms" }}
            aria-live="polite"
          >
            {t("lossStopped")}
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-muted">{t("mockNote")}</p>
    </div>
  );
}
