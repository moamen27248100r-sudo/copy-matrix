import { ChevronRight, BadgeCheck } from "lucide-react";
import { StatusBar, BottomNav } from "../ScreenChrome";
import { PerformanceChart } from "../PerformanceChart";
import { Logo } from "@/components/Logo";
import { showcaseTrader } from "@/data/showcase-data";

const initials = showcaseTrader.name
  .split(" ")
  .slice(0, 2)
  .map((w) => w[0])
  .join("");

export function TraderProfileScreen({ active, reducedMotion }: { active: boolean; reducedMotion: boolean }) {
  const t = showcaseTrader;
  return (
    <div className="flex h-full flex-col" dir="rtl" aria-hidden="true">
      <StatusBar />
      <div className="flex items-center justify-between px-4 pt-3">
        <ChevronRight className="h-4 w-4 text-muted" />
        <Logo iconClassName="h-3 w-3" textClassName="text-[11px]" />
      </div>

      <div className="flex flex-1 flex-col gap-4 px-4 pt-4">
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-blue-600 text-base font-bold text-white">
            {initials}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <p className="truncate text-sm font-semibold text-white">{t.name}</p>
              <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-accent" />
            </div>
            <p className="truncate text-[11px] text-muted">{t.bio}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 rounded-xl border border-white/[0.06] bg-white/[0.03]">
          <div className="flex flex-col items-center gap-0.5 border-e border-white/[0.06] py-2.5 text-center">
            <p className="text-[13px] font-bold tabular-nums text-[#22C55E]" dir="ltr">
              +{t.return12mPct}%
            </p>
            <p className="text-[9px] text-muted">العائد 12 شهر</p>
          </div>
          <div className="flex flex-col items-center gap-0.5 border-e border-white/[0.06] py-2.5 text-center">
            <p className="text-[13px] font-bold tabular-nums text-white" dir="ltr">
              {t.winRatePct}%
            </p>
            <p className="text-[9px] text-muted">نسبة النجاح</p>
          </div>
          <div className="flex flex-col items-center gap-0.5 py-2.5 text-center">
            <p className="text-[13px] font-bold tabular-nums text-[#EF4444]" dir="ltr">
              {t.maxDrawdownPct}%
            </p>
            <p className="text-[9px] text-muted">أقصى تراجع</p>
          </div>
        </div>

        <div className="h-20 w-full">
          <PerformanceChart points={t.monthlyEquity} color="#22C55E" active={active} reducedMotion={reducedMotion} />
        </div>

        <p className="text-[10px] text-muted">
          <span className="font-medium text-white" dir="ltr">
            {t.activeCopiers.toLocaleString("en-US")}
          </span>{" "}
          ناسخ نشط • مستوى مخاطرة {t.riskLevel}
        </p>

        <span className="mt-auto mb-4 block w-full rounded-lg bg-accent py-2.5 text-center text-[11px] font-bold text-accent-foreground shadow-lg shadow-accent/40">
          نسخ المتداول
        </span>
      </div>

      <BottomNav active="traders" />
    </div>
  );
}
