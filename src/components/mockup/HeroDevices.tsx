"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// The hero's device group: a laptop behind and a phone in front. A very light float runs on both
// (different phases); on a desktop with a fine pointer the group tilts a few degrees toward the
// mouse. Everything stops with prefers-reduced-motion. On a phone-size screen only the phone shows.
export function HeroDevices({ phone, laptop, label }: { phone: ReactNode; laptop: ReactNode; label: string }) {
  const stage = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [canTilt, setCanTilt] = useState(false);

  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setCanTilt(fine.matches && !reduce.matches);
    const id = setTimeout(update, 0);
    fine.addEventListener("change", update);
    reduce.addEventListener("change", update);
    return () => {
      clearTimeout(id);
      fine.removeEventListener("change", update);
      reduce.removeEventListener("change", update);
    };
  }, []);

  function onMove(e: React.PointerEvent) {
    if (!canTilt || !stage.current) return;
    const r = stage.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x, y });
  }

  return (
    <div
      ref={stage}
      role="img"
      aria-label={label}
      onPointerMove={onMove}
      onPointerLeave={() => setTilt({ x: 0, y: 0 })}
      className="relative mx-auto w-full max-w-[640px] [perspective:1400px]"
    >
      <div
        className="relative mx-auto transition-transform duration-300 ease-out md:aspect-[1/0.8] md:w-full"
        style={{ transform: canTilt ? `rotateY(${tilt.x * 7}deg) rotateX(${tilt.y * -5}deg)` : undefined, transformStyle: "preserve-3d" }}
      >
        <div className="mockup-float-slow absolute end-0 top-[3%] hidden w-[90%] md:block">{laptop}</div>
        <div className="mockup-float relative mx-auto w-[min(230px,62vw)] md:absolute md:bottom-0 md:start-[1%] md:mx-0 md:w-[31%] md:min-w-[170px]">{phone}</div>
      </div>
    </div>
  );
}
