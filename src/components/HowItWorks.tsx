"use client";

import { Fragment } from "react";
import { useTranslations } from "next-intl";
import { useInView } from "@/components/showcase/hooks";

type Step = { title: string; desc: string };

const STEP_ICON_PATHS = [
  // wallet -- connect account
  <Fragment key="wallet">
    <rect x="3" y="6" width="18" height="13" rx="2" />
    <path d="M3 10h18" />
    <circle cx="16" cy="14.5" r="1" />
  </Fragment>,
  // analytics / chart -- analyze & filter leaders
  <Fragment key="chart">
    <path d="M4 19h16" />
    <rect x="6" y="12" width="3" height="7" />
    <rect x="11" y="8" width="3" height="11" />
    <rect x="16" y="4" width="3" height="15" />
  </Fragment>,
  // dollar / slider -- flexible allocation
  <Fragment key="dollar">
    <line x1="12" y1="2" x2="12" y2="22" />
    <path d="M17 6.5c0-1.4-1.6-2.5-5-2.5s-5 1.1-5 2.5S8.6 9 12 9s5 1.1 5 2.5-1.6 2.5-5 2.5-5-1.1-5-2.5" />
  </Fragment>,
  // lightning -- instant execution
  <path key="bolt" d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />,
];

function StepIcon({ index }: { index: number }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {STEP_ICON_PATHS[index]}
    </svg>
  );
}

function StepBadge({ index }: { index: number }) {
  return (
    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-accent/10 text-accent shadow-[0_0_18px_-3px_var(--accent)]">
      <StepIcon index={index} />
      <span className="absolute -bottom-1 -end-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-accent text-[10px] font-bold text-accent-foreground">
        {index + 1}
      </span>
    </div>
  );
}

const CARD_BASE =
  "rounded-xl border bg-white/[0.03] backdrop-blur-xl p-5 transition-all duration-300 hover:-translate-y-0.5";
const CARD_GLOW = "border-accent/40 shadow-[0_0_28px_-10px_var(--accent)]";
const CARD_IDLE = "border-white/[0.06] hover:border-accent/40 hover:shadow-[0_0_28px_-10px_var(--accent)]";

function StepCard({ title, desc, horizontal = false }: { title: string; desc: string; horizontal?: boolean }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.4);
  return (
    <div
      ref={ref}
      className={`${CARD_BASE} ${inView ? CARD_GLOW : CARD_IDLE} ${horizontal ? "flex h-full flex-col gap-1 text-center" : ""}`}
    >
      <p className="line-clamp-2 text-sm font-semibold text-slate-100">{title}</p>
      <p className={`line-clamp-2 text-sm leading-relaxed text-slate-400 ${horizontal ? "" : "mt-1"}`}>{desc}</p>
    </div>
  );
}

export function HowItWorks() {
  const t = useTranslations("HomeHowItWorks");
  const steps = t.raw("steps") as Step[];
  const lastIndex = steps.length - 1;

  return (
    <section id="how-it-works" className="flex flex-col gap-10 px-6 py-16">
      <div className="mx-auto flex max-w-xl flex-col items-center gap-2 text-center">
        <span className="line-clamp-1 inline-flex w-fit items-center rounded-md border border-slate-700/50 bg-slate-800/60 px-2 py-0.5 text-[11px] font-medium text-slate-300">
          {t("badge")}
        </span>
        <h2 className="line-clamp-1 text-2xl font-semibold text-slate-100 sm:text-3xl">{t("title")}</h2>
        <p className="line-clamp-2 text-sm text-slate-400">{t("subtitle")}</p>
      </div>

      {/* Mobile / tablet: vertical stepper, a glowing icon badge fused
          beside each card and linked by an animated pulse line. */}
      <div className="mx-auto flex w-full max-w-md flex-col md:hidden">
        {steps.map((s, i) => (
          <div key={s.title} className="flex gap-4">
            <div className="flex flex-col items-center">
              <StepBadge index={i} />
              {i < lastIndex && <div className="pulse-line my-1 w-[2px] flex-1 rounded-full" aria-hidden="true" />}
            </div>
            <div className={`flex-1 ${i < lastIndex ? "pb-4" : ""}`}>
              <StepCard title={s.title} desc={s.desc} />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: horizontal 4-column grid, icon badges linked by one
          animated pulse line running through the row. */}
      <div className="relative mx-auto hidden w-full max-w-5xl md:block">
        <div className="pulse-line-horizontal absolute top-[22px] right-7 left-7 h-[2px] rounded-full" aria-hidden="true" />
        <div className="grid grid-cols-4 gap-4 lg:gap-6">
          {steps.map((s, i) => (
            <div key={s.title} className="relative flex h-full flex-col gap-3">
              <div className="relative z-10 flex justify-center">
                <StepBadge index={i} />
              </div>
              <StepCard title={s.title} desc={s.desc} horizontal />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
