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

// Built at a fixed 390px canvas (see ScaledScreenContent) with normal,
// native-app-sized text -- it gets scaled down uniformly to whatever the
// phone's actual rendered width is, so it never needs its own
// per-breakpoint font tuning.
export function TraderProfileScreen({ active, reducedMotion }: { active: boolean; reducedMotion: boolean }) {
  const t = showcaseTrader;
  return (
    <div className="flex h-full flex-col" dir="rtl" aria-hidden="true">
      <StatusBar />
      <div className="flex items-center justify-between px-5 pt-4">
        <ChevronRight className="h-5 w-5 text-muted" />
        <Logo iconClassName="h-4 w-4" textClassName="text-sm" />
      </div>

      <div className="flex flex-1 flex-col gap-5 px-5 pt-5">
        <div className="flex items-center gap-3.5">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-blue-600 text-lg font-bold text-white">
            {initials}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-base font-semibold text-white">{t.name}</p>
              <BadgeCheck className="h-4 w-4 shrink-0 text-accent" />
            </div>
            <p className="truncate text-[13px] text-muted">{t.bio}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 rounded-2xl border border-white/[0.06] bg-white/[0.03]">
          <div className="flex flex-col items-center gap-1 border-e border-white/[0.06] py-3.5 text-center">
            <p className="text-[17px] font-bold tabular-nums text-[#22C55E]" dir="ltr">
              +{t.return12mPct}%
            </p>
            <p className="text-[11px] text-muted">العائد 12 شهر</p>
          </div>
          <div className="flex flex-col items-center gap-1 border-e border-white/[0.06] py-3.5 text-center">
            <p className="text-[17px] font-bold tabular-nums text-white" dir="ltr">
              {t.winRatePct}%
            </p>
            <p className="text-[11px] text-muted">نسبة النجاح</p>
          </div>
          <div className="flex flex-col items-center gap-1 py-3.5 text-center">
            <p className="text-[17px] font-bold tabular-nums text-[#EF4444]" dir="ltr">
              {t.maxDrawdownPct}%
            </p>
            <p className="text-[11px] text-muted">أقصى تراجع</p>
          </div>
        </div>

        <div className="h-28 w-full flex-1">
          <PerformanceChart points={t.monthlyEquity} color="#22C55E" active={active} reducedMotion={reducedMotion} />
        </div>

        <p className="text-[13px] text-muted">
          <span className="font-medium text-white" dir="ltr">
            {t.activeCopiers.toLocaleString("en-US")}
          </span>{" "}
          ناسخ نشط • مستوى مخاطرة {t.riskLevel}
        </p>

        <span className="mb-2 block w-full rounded-xl bg-accent py-3.5 text-center text-[15px] font-bold text-accent-foreground shadow-lg shadow-accent/40">
          نسخ المتداول
        </span>
      </div>

      <BottomNav active="traders" />
    </div>
  );
}
