"use client";

import { useEffect, useState } from "react";

const SCENE_MS = 2400;
const SCENE_COUNT = 4;

const CANDLES = [
  { h: 34, o: 40, c: 30, up: false },
  { h: 30, o: 30, c: 22, up: false },
  { h: 26, o: 22, c: 28, up: true },
  { h: 38, o: 28, c: 44, up: true },
  { h: 20, o: 44, c: 18, up: false },
  { h: 16, o: 18, c: 10, up: false },
  { h: 24, o: 10, c: 26, up: true },
  { h: 34, o: 26, c: 38, up: true },
  { h: 44, o: 38, c: 48, up: true },
  { h: 40, o: 48, c: 42, up: false },
  { h: 50, o: 42, c: 56, up: true },
  { h: 58, o: 56, c: 66, up: true },
];

export function HeroPhoneMockup() {
  const [scene, setScene] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setScene((s) => (s + 1) % SCENE_COUNT), SCENE_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-2xl px-4 pb-16 pt-10" style={{ perspective: "1000px" }}>
      <div
        className="pointer-events-none absolute inset-0 -z-10 mx-auto h-[460px] w-[460px] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(34,211,238,0.32), rgba(30,64,175,0.2) 45%, transparent 72%)" }}
      />

      <div
        className="relative mx-auto w-[260px] sm:w-[300px]"
        style={{ transform: "perspective(1000px) rotateX(10deg) rotateY(-12deg) rotateZ(3deg)", transformStyle: "preserve-3d" }}
      >
        <span className="absolute -start-[3px] top-24 h-8 w-[3px] rounded-s-sm bg-slate-700" />
        <span className="absolute -start-[3px] top-36 h-12 w-[3px] rounded-s-sm bg-slate-700" />
        <span className="absolute -end-[3px] top-28 h-16 w-[3px] rounded-e-sm bg-slate-700" />

        {/* metallic gleam border */}
        <div className="relative rounded-[2.9rem] bg-[linear-gradient(135deg,#cbd5e1_0%,#475569_28%,#0f172a_55%,#64748b_78%,#e2e8f0_100%)] p-[3px] shadow-[0_45px_80px_-15px_rgba(8,145,178,0.35)]">
          <div className="relative overflow-hidden rounded-[2.75rem] border border-black/60 bg-[#090D16]">
            <span className="absolute inset-x-0 top-2.5 z-30 mx-auto block h-6 w-28 rounded-full bg-black" />
            {/* glassy reflective sheen */}
            <div
              className="pointer-events-none absolute inset-0 z-20"
              style={{ background: "linear-gradient(115deg, rgba(255,255,255,0.1) 0%, transparent 20%, transparent 80%, rgba(255,255,255,0.06) 100%)" }}
            />

            <div className="relative h-[460px] overflow-hidden">
              <SplashScene active={scene === 0} />
              <SignalsScene active={scene === 1} />
              <TapScene active={scene === 2} />
              <PortfolioScene active={scene === 3} />
            </div>
          </div>
        </div>

        {/* floating glassmorphic notification, escaping the left edge */}
        <div
          className="absolute left-0 top-1/2 w-40 -translate-x-1/3 -translate-y-1/2 rounded-xl border border-white/10 bg-white/[0.08] p-3 shadow-2xl shadow-black/50 backdrop-blur-xl"
          style={{ transform: "translateX(-33%) translateY(-50%) translateZ(40px)" }}
        >
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-sm">🥇</span>
            <p className="text-[11px] leading-tight text-white">تم نسخ صفقة ذهب جديدة +$140</p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-center gap-1.5">
        {Array.from({ length: SCENE_COUNT }).map((_, i) => (
          <span
            key={i}
            className={i === scene ? "h-1.5 w-4 rounded-full bg-accent transition-all" : "h-1.5 w-1.5 rounded-full bg-white/15 transition-all"}
          />
        ))}
      </div>
    </div>
  );
}

function SceneWrap({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <div
      className={
        "absolute inset-0 flex flex-col px-3.5 pb-6 pt-10 transition-all duration-700 ease-out " +
        (active ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-4 opacity-0")
      }
    >
      {children}
    </div>
  );
}

function SplashScene({ active }: { active: boolean }) {
  return (
    <div
      className={
        "absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black transition-opacity duration-700 " +
        (active ? "opacity-100" : "pointer-events-none opacity-0")
      }
    >
      <p className={"text-2xl font-extrabold text-white transition-all duration-1000 " + (active ? "scale-100 opacity-100" : "scale-90 opacity-0")} style={{ textShadow: "0 0 22px rgba(59,130,246,0.9)" }}>
        Copy Matrix
      </p>
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-accent" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  );
}

function CandleChart({ tint }: { tint: string }) {
  return (
    <svg viewBox="0 0 240 70" className="h-full w-full" preserveAspectRatio="none">
      {CANDLES.map((c, i) => {
        const x = i * 20 + 6;
        const color = c.up ? "#4ade80" : "#f43f5e";
        const bodyTop = 70 - Math.max(c.o, c.c);
        const bodyH = Math.max(2, Math.abs(c.c - c.o));
        return (
          <g key={i}>
            <line x1={x} y1={70 - c.h} x2={x} y2={70 - Math.min(c.o, c.c)} stroke={color} strokeWidth="1.5" />
            <rect x={x - 3} y={bodyTop} width="6" height={bodyH} fill={color} rx="1" />
          </g>
        );
      })}
      <polyline
        points={CANDLES.map((c, i) => `${i * 20 + 6},${70 - c.c}`).join(" ")}
        fill="none"
        stroke={tint}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
        style={{ filter: `drop-shadow(0 0 4px ${tint})` }}
      />
    </svg>
  );
}

function SignalsScene({ active }: { active: boolean }) {
  return (
    <SceneWrap active={active}>
      <p className="text-xs font-semibold text-white">توصيات نسخ حية</p>
      <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-white" dir="ltr">XAUUSD</span>
          <span className="text-[11px] font-semibold text-success">+2.9%</span>
        </div>
        <div className="mt-1.5 h-16"><CandleChart tint="#22d3ee" /></div>
      </div>
      <div className="mt-2.5 rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-white" dir="ltr">BTCUSDT</span>
          <span className="text-[11px] font-semibold text-success">+1.6%</span>
        </div>
        <div className="mt-1.5 h-16"><CandleChart tint="#a78bfa" /></div>
      </div>
    </SceneWrap>
  );
}

function TapScene({ active }: { active: boolean }) {
  return (
    <SceneWrap active={active}>
      <p className="text-xs font-semibold text-white">نسخ الصفقة</p>
      <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.05] p-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-white" dir="ltr">XAUUSD</span>
          <span className="text-[11px] font-semibold text-success">+19.5%</span>
        </div>
        <div className="relative mt-3">
          <span className="block w-full rounded-lg bg-accent py-2 text-center text-[11px] font-bold text-accent-foreground shadow-lg shadow-accent/40">
            نسخ الصفقات تلقائيًا
          </span>
          <span className="pointer-events-none absolute -end-1 -top-1 flex h-6 w-6 items-center justify-center">
            <span className="absolute h-6 w-6 animate-ping rounded-full bg-white/60" />
            <span className="relative h-3 w-3 rounded-full border-2 border-white bg-white/80 shadow-lg" />
          </span>
        </div>
      </div>
    </SceneWrap>
  );
}

function PortfolioScene({ active }: { active: boolean }) {
  return (
    <SceneWrap active={active}>
      <p className="text-xs font-semibold text-white">محفظتي الأسبوعية</p>
      <p className="mt-1 text-2xl font-extrabold text-white" dir="ltr">$12,480</p>
      <span className="mt-1 inline-block w-fit rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-bold text-success" dir="ltr">
        +24.8%
      </span>
      <div className="mt-3 h-24"><CandleChart tint="#4ade80" /></div>
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-success/20 bg-success/10 px-2.5 py-2">
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
        <p className="text-[11px] text-success">تأكيد الأرباح المحققة هذا الأسبوع</p>
      </div>
    </SceneWrap>
  );
}
