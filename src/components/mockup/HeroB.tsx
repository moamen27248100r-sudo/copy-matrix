import { getLocale, getTranslations } from "next-intl/server";
import { BottomNav } from "@/components/BottomNav";
import { ScaledCanvas } from "@/components/mockup/ScaledCanvas";
import { AppHeader, StatusBar } from "@/components/mockup/Screens";
import { HeroPhoneFrame, portfolioPath } from "@/components/mockup/HeroA";
import { GLASS } from "@/components/mockup/HeroA";
import { initialsAvatar } from "@/data/mockup-fixtures";

// Hero mock-up, option B (strict marketing layout): ONE straight phone in the middle, its whole
// screen filled top to bottom with the same margins and type scale, one small floating notification
// that only touches the phone's top edge, a blue glow behind and a soft shadow under. Fixed display
// data only (no real customer or leader); illustrative.

const W = 390;
const H = 844;
const START = 12_084;
const END = 12_480;
const SYMBOL = "XAUUSD";
const TRADERS = [
  { name: "Avery Northfield", pct: "+4.1%", i: 1 },
  { name: "Mika Vandersloot", pct: "+2.7%", i: 2 },
];

async function Screen() {
  const t = await getTranslations("Home.heroPreview");
  const locale = await getLocale();
  const fmt = (n: number) => new Intl.NumberFormat(locale === "ar" ? "en-US" : locale, { maximumFractionDigits: 0 }).format(n);
  const { line, area, endX, endY } = portfolioPath(W, 220);

  return (
    <div className="flex flex-col bg-gradient-to-b from-[#0f1c38] via-[#0b1226] to-[#0b0f17] text-white" style={{ width: W, height: H }}>
      <StatusBar />
      <AppHeader />

      {/* value: every block of the screen uses the same 20px side margin */}
      <div className="px-5 pt-6">
        <p className="text-[14px] font-medium text-[#8B95A7]">{t("portfolioValue")}</p>
        <p className="mt-1 text-start text-[52px] font-extrabold leading-none tracking-tight tabular-nums">
          <span dir="ltr" className="inline-block">
            ${fmt(END)}
          </span>
        </p>
        <p className="mt-2 text-start text-[15px] font-semibold text-[#22C55E]">
          <span dir="ltr" className="inline-block">
            +${fmt(END - START)} (+3.3%)
          </span>{" "}
          <span className="font-medium text-[#8B95A7]">{t("thisMonth")}</span>
        </p>
      </div>

      {/* the curve: the whole screen width, nothing on top of it, no axes */}
      <div className="mt-4 min-h-0 flex-1">
        <svg viewBox={`0 0 ${W} 220`} preserveAspectRatio="none" className="block h-full w-full" aria-hidden="true">
          <defs>
            <linearGradient id="heroBFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#1E3A8A" stopOpacity="0.6" />
              <stop offset="1" stopColor="#1E3A8A" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#heroBFill)" />
          <path d={line} fill="none" stroke="#3D6FD9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <circle cx={endX - 6} cy={endY} r="4.5" fill="#FFFFFF" />
        </svg>
      </div>

      <div className="px-5 pb-4 pt-4">
        <p className="mb-3 text-[15px] font-semibold text-[#C7CFDD]">{t("copyingNow")}</p>
        <div className="flex flex-col gap-2.5">
          {TRADERS.map((tr) => (
            <div key={tr.name} className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={initialsAvatar(tr.name, tr.i)} alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-full" />
              <span className="min-w-0 flex-1 text-[16px] font-semibold leading-tight">{tr.name}</span>
              <span className="shrink-0 text-end">
                <span dir="ltr" className="block text-[16px] font-bold text-[#22C55E]">
                  {tr.pct}
                </span>
                <span className="block text-[11.5px] font-medium text-[#8B95A7]">{t("thisMonth")}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-3 pb-6">
        <BottomNav embedded activeHref="/dashboard" />
      </div>
    </div>
  );
}

export async function HeroMockupB() {
  const t = await getTranslations("Home.heroPreview");
  return (
    <div role="img" aria-label={t("aria")} className="relative mx-auto flex w-full justify-center px-4 pb-6 pt-14">
      {/* glow behind the phone only */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[78%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(47,111,237,0.42) 0%, rgba(30,58,138,0.24) 40%, rgba(11,15,23,0) 70%)", filter: "blur(40px)" }}
      />
      <div className="relative w-[70vw] max-w-[300px] lg:w-[320px] lg:max-w-none">
        {/* the one floating element: it overlaps only the top edge of the phone, never the screen */}
        <div
          className={`mockup-float absolute -end-[14%] -top-9 z-40 flex w-max max-w-[50%] items-center gap-1.5 whitespace-nowrap rounded-2xl px-2 py-1.5 ${GLASS}`}
          style={{ animationDelay: "-2s" }}
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#2f6fed]/25 text-[#8fb4ff]">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="9" width="11" height="11" rx="2.5" />
              <path d="M15 9V6.5A2.5 2.5 0 0 0 12.5 4h-6A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15H9" />
            </svg>
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block text-[10.5px] font-semibold text-white">{t("tradeCopied")}</span>
            <span className="block text-[9.5px] text-[#9AA6BC]">
              <span dir="ltr">{SYMBOL}</span> {t("buy")} · {t("now")}
            </span>
          </span>
        </div>

        <HeroPhoneFrame>
          <ScaledCanvas width={W} height={H}>
            <Screen />
          </ScaledCanvas>
        </HeroPhoneFrame>

        {/* a soft, deep shadow on the ground under the phone */}
        <div
          className="pointer-events-none absolute -bottom-6 left-1/2 -z-10 h-10 w-[84%] -translate-x-1/2 rounded-[50%]"
          style={{ background: "rgba(0,0,0,0.7)", filter: "blur(22px)" }}
        />
      </div>
    </div>
  );
}
