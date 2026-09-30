"use client";

import { useTranslations } from "next-intl";
import { PhoneFrame } from "./PhoneFrame";
import { ScaledScreenContent } from "./ScaledScreenContent";
import { TraderProfileScreen } from "./screens/TraderProfileScreen";
import { LiveTradesScreen } from "./screens/LiveTradesScreen";
import { PortfolioScreen } from "./screens/PortfolioScreen";
import { FloatingStatCard } from "./FloatingStatCard";
import { TradeNotificationStack } from "./TradeNotificationStack";
import { usePrefersReducedMotion, useIsDesktop, useInView, useShowcaseTick } from "./hooks";
import { showcaseFloatingStats } from "@/data/showcase-data";

const TICKS_PER_SCREEN = 6; // 6s per screen off the 1s central tick
const SCREEN_COUNT = 3;
const FRONT_WIDTH = "w-[min(220px,58vw)] md:w-[250px] lg:w-[280px]";
const BACK_WIDTH = "w-[220px] lg:w-[246px]";

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

function TopTraderCard({ reducedMotion }: { reducedMotion: boolean }) {
  const t = useTranslations("HomeShowcase");
  return (
    <FloatingStatCard delaySeconds={0} reducedMotion={reducedMotion} className="w-[170px]">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-xs font-bold text-slate-900">
          {showcaseFloatingStats.topTrader.name[0]}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium text-white">{t("topTrader")}</p>
          <p className="text-[13px] font-bold text-[#22C55E]" dir="ltr">
            +{showcaseFloatingStats.topTrader.monthlyReturnPct}%
          </p>
        </div>
      </div>
    </FloatingStatCard>
  );
}

function FrontPhoneScreens({ tick, activeScreen, reducedMotion }: { tick: number; activeScreen: number; reducedMotion: boolean }) {
  return Array.from({ length: SCREEN_COUNT }, (_, i) => (i - activeScreen + SCREEN_COUNT) % SCREEN_COUNT).map((diff, i) => (
    <ScreenSlide key={i} diff={diff}>
      <ScaledScreenContent>
        {i === 0 && <TraderProfileScreen active={activeScreen === 0} reducedMotion={reducedMotion} />}
        {i === 1 && <LiveTradesScreen tick={tick} />}
        {i === 2 && <PortfolioScreen />}
      </ScaledScreenContent>
    </ScreenSlide>
  ));
}

export function ProductShowcase() {
  const t = useTranslations("HomeShowcase");
  const { ref, inView } = useInView<HTMLElement>();
  const reducedMotion = usePrefersReducedMotion();
  const isTabletUp = useIsDesktop(768);
  const paused = !inView || reducedMotion;
  const tick = useShowcaseTick(paused);
  const activeScreen = Math.floor(tick / TICKS_PER_SCREEN) % SCREEN_COUNT;

  return (
    <section
      ref={ref}
      role="img"
      aria-label={t("aria")}
      className="relative w-full overflow-x-hidden px-3 py-4 md:py-10 lg:py-0"
    >
      <div
        className={"pointer-events-none absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 rounded-full " + (reducedMotion ? "" : "showcase-glow-pulse")}
        style={{ width: "70%", height: "70%", background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 12%, transparent) 0%, transparent 70%)", filter: "blur(90px)" }}
      />

      {isTabletUp ? (
        <div className="relative mx-auto flex h-[620px] max-w-[640px] items-center justify-center">
          {/* back phone: smaller, offset up-left by 30% of its own size, tilted */}
          <div className="relative" style={{ transform: "translate(-30%, -30%) rotate(6deg)", opacity: 0.9 }}>
            <PhoneFrame widthClassName={BACK_WIDTH}>
              <ScaledScreenContent>
                <LiveTradesScreen tick={tick} />
              </ScaledScreenContent>
            </PhoneFrame>
          </div>

          {/* front phone: static trader-profile screen, sits above the back one */}
          <div
            className="relative -ms-16"
            style={{ boxShadow: "-24px 28px 50px -20px rgba(0,0,0,0.55)" }}
          >
            <PhoneFrame widthClassName={FRONT_WIDTH} rotateClassName="lg:rotate-[-4deg]">
              <ScaledScreenContent>
                <TraderProfileScreen active reducedMotion={reducedMotion} />
              </ScaledScreenContent>
            </PhoneFrame>
            <div className="absolute right-0 top-0" style={{ transform: "translate(35%, -50%)" }}>
              <TopTraderCard reducedMotion={reducedMotion} />
            </div>
            <div className="absolute bottom-0 right-0" style={{ transform: "translate(38%, 40%)" }}>
              <TradeNotificationStack tick={tick} count={3} />
            </div>
          </div>
        </div>
      ) : (
        // Phones-on-phones: only the top half of the phone is shown so the
        // hero doesn't push the CTA far below the fold; no floating cards.
        <div className="relative mx-auto flex h-[250px] w-full max-w-[360px] items-start justify-center overflow-hidden">
          <PhoneFrame widthClassName={FRONT_WIDTH}>
            <FrontPhoneScreens tick={tick} activeScreen={activeScreen} reducedMotion={reducedMotion} />
          </PhoneFrame>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent" />
        </div>
      )}

      <p className="mx-auto mt-3 max-w-sm md:mt-6 text-center text-[11px] text-muted">{t("disclaimer")}</p>

      <style>{`
        @keyframes showcaseGlowPulse { 0%, 100% { opacity: 0.714; } 50% { opacity: 1; } }
        .showcase-glow-pulse { animation: showcaseGlowPulse 6s ease-in-out infinite; }
      `}</style>
    </section>
  );
}
