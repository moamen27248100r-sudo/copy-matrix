"use client";

import { useEffect, useRef, useState } from "react";
import { Users } from "lucide-react";
import { PhoneFrame } from "./PhoneFrame";
import { TraderProfileScreen } from "./screens/TraderProfileScreen";
import { LiveTradesScreen } from "./screens/LiveTradesScreen";
import { PortfolioScreen } from "./screens/PortfolioScreen";
import { FloatingStatCard, CountUpNumber } from "./FloatingStatCard";
import { TradeNotificationStack } from "./TradeNotificationStack";
import { usePrefersReducedMotion, useIsDesktop, useInView, useShowcaseTick } from "./hooks";
import { showcaseFloatingStats, showcaseDisclaimer } from "@/data/showcase-data";

const MAX_TILT = 3;
const TICKS_PER_SCREEN = 6; // 6s per screen off the 1s central tick
const SCREEN_COUNT = 3;

function ScreenSlide({ diff, children }: { diff: number; children: React.ReactNode }) {
  // diff: 0 = active/centered, 1 = upcoming (slides in from the RTL
  // "forward" side), 2 (== -1 mod 3) = just-left screen.
  const offset = diff === 0 ? "translate-x-0" : diff === 1 ? "-translate-x-full" : "translate-x-full";
  return (
    <div
      className={
        "absolute inset-0 transition-[transform,opacity] duration-500 ease-out " +
        offset +
        " " +
        (diff === 0 ? "opacity-100" : "invisible opacity-0")
      }
    >
      {children}
    </div>
  );
}

export function ProductShowcase() {
  const { ref, inView } = useInView<HTMLElement>();
  const reducedMotion = usePrefersReducedMotion();
  const isDesktop = useIsDesktop();
  const [tiltY, setTiltY] = useState(0);
  const sceneRef = useRef<HTMLElement>(null);
  const paused = !inView || reducedMotion;
  const tick = useShowcaseTick(paused);
  const activeScreen = Math.floor(tick / TICKS_PER_SCREEN) % SCREEN_COUNT;

  useEffect(() => {
    if (reducedMotion) return;
    const el = sceneRef.current;
    if (!el || !window.matchMedia("(pointer: fine)").matches) return;
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const relX = (e.clientX - rect.left) / rect.width - 0.5;
      setTiltY(relX * MAX_TILT * 2);
    };
    const onLeave = () => setTiltY(0);
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [reducedMotion]);

  const phone = (
    <PhoneFrame extraRotateY={tiltY} reducedMotion={reducedMotion}>
      {Array.from({ length: SCREEN_COUNT }, (_, i) => (i - activeScreen + SCREEN_COUNT) % SCREEN_COUNT).map((diff, i) => (
        <ScreenSlide key={i} diff={diff}>
          {i === 0 && <TraderProfileScreen active={activeScreen === 0} reducedMotion={reducedMotion} />}
          {i === 1 && <LiveTradesScreen tick={tick} />}
          {i === 2 && <PortfolioScreen />}
        </ScreenSlide>
      ))}
    </PhoneFrame>
  );

  const topTraderCard = (
    <FloatingStatCard delaySeconds={0} reducedMotion={reducedMotion} className="w-36">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-[10px] font-bold text-slate-900">
          {showcaseFloatingStats.topTrader.name[0]}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[10px] font-medium text-white">متداول الشهر</p>
          <p className="text-[10px] font-bold text-[#22C55E]" dir="ltr">
            +{showcaseFloatingStats.topTrader.monthlyReturnPct}%
          </p>
        </div>
      </div>
    </FloatingStatCard>
  );

  // A 240px phone leaves very little room beside it on a 375px screen --
  // this is a narrow, single-column variant (not the wide desktop card)
  // sized to actually fit within the 16px page margin at that width.
  const topTraderCardCompact = (
    <FloatingStatCard delaySeconds={0} reducedMotion={reducedMotion} className="w-16 !p-1.5">
      <div className="flex flex-col items-center gap-0.5 text-center">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-[8px] font-bold text-slate-900">
          {showcaseFloatingStats.topTrader.name[0]}
        </span>
        <p className="text-[9px] font-bold leading-none text-[#22C55E]" dir="ltr">
          +{showcaseFloatingStats.topTrader.monthlyReturnPct}%
        </p>
      </div>
    </FloatingStatCard>
  );

  const activeCopiersCard = (
    <FloatingStatCard delaySeconds={1.5} reducedMotion={reducedMotion} className="w-36">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 shrink-0 text-accent" />
        <div>
          <p className="text-[12px] font-bold text-white">
            <CountUpNumber value={showcaseFloatingStats.activeCopiers} start={inView} />
          </p>
          <p className="text-[9px] text-muted">ناسخ نشط</p>
        </div>
      </div>
    </FloatingStatCard>
  );

  const tradesTodayCard = (
    <FloatingStatCard delaySeconds={3} reducedMotion={reducedMotion} className="w-36">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#22C55E]" />
        <div>
          <p className="text-[12px] font-bold text-white">
            <CountUpNumber value={showcaseFloatingStats.tradesToday} start={inView} />
          </p>
          <p className="text-[9px] text-muted">صفقات منفذة اليوم</p>
        </div>
      </div>
    </FloatingStatCard>
  );

  return (
    <section
      ref={(el) => {
        ref.current = el;
        sceneRef.current = el;
      }}
      role="img"
      aria-label="عرض توضيحي لواجهة المنصة"
      className="relative mx-auto w-full max-w-[1000px] overflow-x-hidden px-4 py-12"
      style={{ perspective: "2000px" }}
    >
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 rounded-full showcase-glow-pulse"
        style={{ width: "60%", height: "60%", background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 12%, transparent) 0%, transparent 70%)", filter: "blur(90px)" }}
      />
      <div
        className="pointer-events-none absolute left-1/2 top-[58%] -z-10 h-[65%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60"
        style={{ background: "radial-gradient(ellipse, rgba(0,0,0,0.35), transparent 70%)", filter: "blur(50px)" }}
      />

      {isDesktop ? (
        <div className="relative mx-auto h-[680px] max-w-[720px]">
          <div className="absolute left-1/2 top-1/2" style={{ transform: "translate(-50%, -50%)" }}>
            {phone}
          </div>
          <div className="absolute top-[16%]" style={{ left: "calc(50% + 113px)" }}>
            {topTraderCard}
          </div>
          <div className="absolute bottom-[18%]" style={{ left: "calc(50% + 113px)" }}>
            {activeCopiersCard}
          </div>
          <div className="absolute top-[16%]" style={{ right: "calc(50% + 113px)" }}>
            {tradesTodayCard}
          </div>
          <div className="absolute bottom-[18%] w-44" style={{ right: "calc(50% + 113px)" }}>
            <TradeNotificationStack tick={tick} count={3} />
          </div>
        </div>
      ) : (
        <div className="relative mx-auto h-[560px] w-full max-w-[420px]">
          <div className="absolute top-1/2" style={{ left: "53%", transform: "translate(-50%, -50%)" }}>
            {phone}
          </div>
          <div className="absolute top-[16%]" style={{ left: "calc(53% + 81px)" }}>
            {topTraderCardCompact}
          </div>
          <div className="absolute bottom-[14%] w-[60px]" style={{ right: "calc(47% + 92px)" }}>
            <TradeNotificationStack tick={tick} count={2} compact />
          </div>
        </div>
      )}

      <p className="mx-auto mt-6 max-w-sm text-center text-[11px] text-muted">{showcaseDisclaimer}</p>

      <style>{`
        @keyframes showcaseGlowPulse { 0%, 100% { opacity: 0.714; } 50% { opacity: 1; } }
        .showcase-glow-pulse { animation: showcaseGlowPulse 6s ease-in-out infinite; }
      `}</style>
    </section>
  );
}
