import { Shield } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { ScaledCanvas } from "@/components/mockup/ScaledCanvas";
import { initialsAvatar } from "@/data/mockup-fixtures";

// Hero mock-up, option A (marketing style): one smaller phone with a simplified screen, a blue glow
// behind it, glass cards floating around it and the bottom of the phone fading into the page.
// Fixed display data only (no real customer or leader); illustrative.

const PHONE = { width: 390, height: 844 } as const;
// fictional names and the instrument shown in the cards
const SYMBOL = "XAUUSD";
const FEATURED = "Soren Halvarsen";
const START = 12_084;
const END = 12_480;

/** The portfolio value over the month: from 12,084 to 12,480 with a natural dip, no axes. */
function portfolioPath(w: number, h: number) {
  const n = 36;
  const pts: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const trend = START + (END - START) * (t * 0.82 + 0.18 * t * t);
    const wave = Math.sin(t * 9.4) * 34 + Math.sin(t * 23 + 1.3) * 11 - (t > 0.52 && t < 0.66 ? 70 * Math.sin(((t - 0.52) / 0.14) * Math.PI) : 0);
    pts.push(trend + wave * (1 - t * 0.55));
  }
  pts[0] = START;
  pts[n - 1] = END;
  const lo = Math.min(...pts) - 20;
  const hi = Math.max(...pts) + 20;
  const x = (i: number) => (i / (n - 1)) * w;
  const y = (v: number) => h - ((v - lo) / (hi - lo)) * (h - 14) - 4;
  let d = `M ${x(0).toFixed(1)} ${y(pts[0]).toFixed(1)}`;
  for (let i = 1; i < n; i++) {
    const cx = (x(i - 1) + x(i)) / 2;
    const cy = (y(pts[i - 1]) + y(pts[i])) / 2;
    d += ` Q ${x(i - 1).toFixed(1)} ${y(pts[i - 1]).toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)}`;
  }
  d += ` T ${x(n - 1).toFixed(1)} ${y(pts[n - 1]).toFixed(1)}`;
  return { line: d, area: `${d} L ${w} ${h} L 0 ${h} Z`, endX: x(n - 1), endY: y(pts[n - 1]) };
}

async function HeroPhoneScreen() {
  const t = await getTranslations("Home.heroPreview");
  const locale = await getLocale();
  const fmt = (n: number) => new Intl.NumberFormat(locale === "ar" ? "en-US" : locale, { maximumFractionDigits: 0 }).format(n);
  const w = 342;
  const h = 150;
  const { line, area, endX, endY } = portfolioPath(w, h);
  const traders = [
    { name: "Avery Northfield", pct: "+4.1%", i: 1 },
    { name: "Mika Vandersloot", pct: "+2.7%", i: 2 },
  ];
  return (
    <div className="relative flex h-full w-full flex-col bg-gradient-to-b from-[#0f1c38] via-[#0b1226] to-[#0b0f17] px-6 pt-16 text-white" style={{ width: PHONE.width, height: PHONE.height }}>
      <p className="text-[15px] font-medium text-[#8B95A7]">{t("portfolioValue")}</p>
      <p className="mt-1 text-start text-[58px] font-extrabold leading-none tracking-tight tabular-nums">
        <span dir="ltr" className="inline-block">
          ${fmt(END)}
        </span>
      </p>
      <p className="mt-2 text-start text-[16px] font-semibold text-[#22C55E]">
        <span dir="ltr" className="inline-block">
          +${fmt(END - START)} (+3.3%)
        </span>{" "}
        <span className="font-medium text-[#8B95A7]">{t("thisMonth")}</span>
      </p>

      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="mt-6" aria-hidden="true">
        <defs>
          <linearGradient id="heroFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#1E3A8A" stopOpacity="0.55" />
            <stop offset="1" stopColor="#1E3A8A" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#heroFill)" />
        <path d={line} fill="none" stroke="#3D6FD9" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={endX} cy={endY} r="9" fill="#3D6FD9" opacity="0.25" />
        <circle cx={endX} cy={endY} r="4.5" fill="#FFFFFF" />
      </svg>

      <p className="mb-3 mt-8 text-[15px] font-semibold text-[#C7CFDD]">{t("copyingNow")}</p>
      <div className="flex flex-col gap-3">
        {traders.map((tr) => (
          <div key={tr.name} className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={initialsAvatar(tr.name, tr.i)} alt="" width={44} height={44} className="h-11 w-11 rounded-full" />
            <span className="min-w-0 flex-1 truncate text-[16px] font-semibold">{tr.name}</span>
            <span dir="ltr" className="text-[17px] font-bold text-[#22C55E]">
              {tr.pct}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HeroPhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-full" style={{ aspectRatio: "390 / 844" }}>
      <span className="absolute -start-[3px] top-[14%] h-[3.2%] w-[4px] rounded-s-sm bg-gradient-to-b from-[#6b7384] to-[#3b4250]" />
      <span className="absolute -start-[3px] top-[20%] h-[6.2%] w-[4px] rounded-s-sm bg-gradient-to-b from-[#6b7384] to-[#3b4250]" />
      <span className="absolute -start-[3px] top-[28.5%] h-[6.2%] w-[4px] rounded-s-sm bg-gradient-to-b from-[#6b7384] to-[#3b4250]" />
      <span className="absolute -end-[3px] top-[24%] h-[9.5%] w-[4px] rounded-e-sm bg-gradient-to-b from-[#6b7384] to-[#3b4250]" />
      <div
        className="absolute inset-0 rounded-[13.5%/6.2%] p-[1.3%]"
        style={{
          background: "linear-gradient(135deg, #e3e8f2 0%, #8e97a8 14%, #3a4151 34%, #1f242d 52%, #70798b 74%, #d4dae6 100%)",
          boxShadow:
            "0 0 0 1px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.55), 0 50px 90px -30px rgba(0,0,0,0.85), 0 30px 60px -20px rgba(24,60,160,0.45)",
        }}
      >
        <div className="relative h-full w-full overflow-hidden rounded-[12.3%/5.7%] bg-black p-[2.5%]">
          <div className="relative h-full w-full overflow-hidden rounded-[10.2%/4.7%] bg-[#0b0f17]">
            {children}
            <span className="absolute inset-x-0 top-[1.3%] z-30 mx-auto block h-[3.4%] w-[29%] rounded-full bg-black" />
            <span
              className="pointer-events-none absolute inset-0 z-20"
              style={{ background: "linear-gradient(115deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 18%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 78%, rgba(255,255,255,0.05) 100%)" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

const GLASS = "border border-white/[0.16] bg-white/[0.07] shadow-[0_22px_48px_-16px_rgba(0,0,0,0.7)] backdrop-blur-xl";

export async function HeroMockupA() {
  const t = await getTranslations("Home.heroPreview");
  return (
    <div role="img" aria-label={t("aria")} className="relative mx-auto w-full max-w-[560px] overflow-x-clip px-10 py-6 lg:max-w-none lg:px-24">
      {/* the glow: a soft blue disc from the platform colours, fading into the navy background */}
      <div
        className="pointer-events-none absolute left-1/2 top-[44%] -z-10 h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(47,111,237,0.42) 0%, rgba(30,58,138,0.28) 32%, rgba(11,15,23,0) 66%)",
          filter: "blur(36px)",
        }}
      />
      <div
        className="pointer-events-none absolute left-1/2 top-[18%] -z-10 h-[46%] w-[60%] -translate-x-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(94,160,255,0.22) 0%, rgba(11,15,23,0) 70%)", filter: "blur(30px)" }}
      />

      <div className="relative mx-auto w-[62vw] max-w-[290px] lg:w-[300px] lg:max-w-none">
        {/* only the top part of the phone is shown; it dissolves into the background */}
        <div className="relative" style={{ aspectRatio: "390 / 690", overflow: "hidden", maskImage: "linear-gradient(to bottom, #000 62%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, #000 62%, transparent 100%)" }}>
          <HeroPhoneFrame>
            <ScaledCanvas width={PHONE.width} height={PHONE.height}>
              <HeroPhoneScreen />
            </ScaledCanvas>
          </HeroPhoneFrame>
        </div>

        {/* floating glass cards, partly outside the phone, floating slowly one after another */}
        <div
          className={`mockup-float absolute -end-[17%] top-[35%] flex w-max max-w-[196px] lg:-end-[30%] lg:top-[13%] lg:max-w-[250px] items-center gap-2.5 rounded-2xl px-3 py-2.5 ${GLASS}`}
          style={{ animationDelay: "-1s" }}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#2f6fed]/25 text-[#8fb4ff]">
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="9" width="11" height="11" rx="2.5" />
              <path d="M15 9V6.5A2.5 2.5 0 0 0 12.5 4h-6A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15H9" />
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block whitespace-nowrap text-[12px] font-semibold text-white">
              {t("tradeCopied")} · <span dir="ltr">{SYMBOL}</span> {t("buy")}
            </span>
            <span className="block text-[10.5px] text-[#9AA6BC]">{t("now")}</span>
          </span>
        </div>

        <div
          className={`mockup-float-slow absolute -start-[24%] top-[60%] flex w-max max-w-[190px] flex-col lg:-start-[38%] lg:top-[47%] lg:max-w-none lg:min-w-[176px] gap-2 rounded-2xl px-3.5 py-3 ${GLASS}`}
          style={{ animationDelay: "-3.5s" }}
        >
          <span className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={initialsAvatar(FEATURED, 3)} alt="" width={36} height={36} className="h-9 w-9 rounded-full" />
            <span className="min-w-0">
              <span className="block truncate text-[12.5px] font-semibold text-white">{FEATURED}</span>
              <span dir="ltr" className="block text-[12px] font-bold text-[#22C55E]">
                +4.1% <span className="font-medium text-[#9AA6BC]">{t("thisMonth")}</span>
              </span>
            </span>
          </span>
          <span className="w-fit rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-300">{t("lowRisk")}</span>
        </div>

        <div
          className={`mockup-float absolute -end-[14%] bottom-[16%] flex items-center lg:-end-[22%] lg:bottom-[20%] gap-2 rounded-full px-3 py-2 ${GLASS}`}
          style={{ animationDelay: "-5.5s" }}
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300">
            <Shield className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden="true" />
          </span>
          <span className="text-[12px] font-semibold text-white">{t("lossLimit")}</span>
        </div>
      </div>
    </div>
  );
}
