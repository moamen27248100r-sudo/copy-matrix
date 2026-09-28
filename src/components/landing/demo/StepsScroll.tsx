"use client";

import { useEffect, useRef, useState } from "react";
import { PhoneShell } from "@/components/landing/demo/shells";
import { TraderListScreen, CopyDialogScreen, MyCopiesScreen } from "@/components/landing/demo/screens";
import { useOnScreen } from "@/components/landing/useInView";

type Step = { title: string; desc: string; alt: string };

function StepText({ n, step }: { n: number; step: Step }) {
  return (
    <div className="flex flex-col gap-3">
      <span className="num text-5xl font-semibold text-text-3">{n}</span>
      <h3 className="text-2xl font-semibold">{step.title}</h3>
      <p className="max-w-md text-base leading-7 text-muted">{step.desc}</p>
    </div>
  );
}

function MobileStep({ n, step, index }: { n: number; step: Step; index: number }) {
  const { ref, visible } = useOnScreen<HTMLLIElement>();
  return (
    <li ref={ref} className="flex flex-col gap-6 border-t border-border pt-6">
      <StepText n={n} step={step} />
      <PhoneShell width={260} label={step.alt}>
        {index === 0 && <TraderListScreen />}
        {index === 1 && <CopyDialogScreen />}
        {index === 2 && <MyCopiesScreen live={visible} />}
      </PhoneShell>
    </li>
  );
}

// Three steps. Desktop: a sticky flat phone whose screen cross-fades as the
// matching step text scrolls through the middle of the viewport. Mobile: each
// step is followed by its own phone (no sticky).
export function StepsScroll({ steps }: { steps: Step[] }) {
  const [active, setActive] = useState(0);
  const blocks = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i));
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    blocks.current.forEach((b) => b && io.observe(b));
    return () => io.disconnect();
  }, []);

  const screen = "absolute inset-0 transition-[opacity,transform] duration-500 motion-reduce:transition-none";

  return (
    <>
      <ol className="flex flex-col gap-14 lg:hidden">
        {steps.map((s, i) => (
          <MobileStep key={s.title} n={i + 1} step={s} index={i} />
        ))}
      </ol>

      <div className="hidden lg:grid lg:grid-cols-2 lg:gap-16">
        <ol>
          {steps.map((s, i) => (
            <li
              key={s.title}
              data-i={i}
              ref={(el) => {
                blocks.current[i] = el as unknown as HTMLDivElement;
              }}
              className={`flex min-h-[75vh] items-center transition-opacity duration-300 ${active === i ? "opacity-100" : "opacity-40"}`}
            >
              <StepText n={i + 1} step={s} />
            </li>
          ))}
        </ol>
        <div className="relative">
          <div className="sticky top-24 flex justify-center pt-4">
            <PhoneShell width={300} label={steps[active]?.alt}>
              <div className="relative h-full w-full">
                {[<TraderListScreen key="a" />, <CopyDialogScreen key="b" />, <MyCopiesScreen key="c" live={active === 2} />].map((el, i) => (
                  <div
                    key={i}
                    className={screen}
                    style={{ opacity: active === i ? 1 : 0, transform: `translateY(${active === i ? 0 : active > i ? -12 : 12}px)` }}
                  >
                    {el}
                  </div>
                ))}
              </div>
            </PhoneShell>
          </div>
        </div>
      </div>
    </>
  );
}
