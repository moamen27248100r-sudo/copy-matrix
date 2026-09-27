"use client";

import { useEffect, useState } from "react";

const SCENE_MS = 2800;

export function HeroPhoneMockup() {
  const [scene, setScene] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setScene((s) => (s + 1) % 3), SCENE_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-2xl px-4 pb-24 pt-10" style={{ perspective: "1400px" }}>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-[420px] w-[420px] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(34,211,238,0.28), rgba(30,64,175,0.18) 45%, transparent 72%)" }}
      />

      <div
        className="relative mx-auto w-[250px] sm:w-[290px]"
        style={{
          maskImage: "linear-gradient(to bottom, black 86%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 86%, transparent 100%)",
        }}
      >
        <div
          className="relative rounded-[2.75rem] border-[6px] border-slate-800 bg-slate-950 shadow-2xl shadow-cyan-500/10"
          style={{ transform: "rotateY(-15deg) rotateX(4deg)", transformStyle: "preserve-3d" }}
        >
          <span className="absolute inset-x-0 top-2.5 z-20 mx-auto block h-6 w-28 rounded-full bg-black" />

          <div className="relative h-[420px] overflow-hidden rounded-[2.2rem] bg-[#0b0e14] pt-9">
            <SplashScene active={scene === 0} />
            <LeaderboardScene active={scene === 1} />
            <PortfolioScene active={scene === 2} />
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-1.5">
        {[0, 1, 2].map((i) => (
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
        "absolute inset-0 top-9 flex flex-col px-3.5 transition-all duration-700 ease-out " +
        (active ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-4 opacity-0")
      }
    >
      {children}
    </div>
  );
}

function SplashScene({ active }: { active: boolean }) {
  return (
    <SceneWrap active={active}>
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <p className="animate-pulse text-2xl font-extrabold text-white [text-shadow:0_0_18px_rgba(59,130,246,0.7)]">
          Copy Matrix
        </p>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 animate-bounce rounded-full bg-accent"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </SceneWrap>
  );
}

function LeaderboardScene({ active }: { active: boolean }) {
  return (
    <SceneWrap active={active}>
      <p className="text-xs font-semibold text-white">قادة التداول</p>
      <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.06] p-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-bold text-accent">
            ي
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white">يوسف علي</p>
            <p className="text-[10px] text-success">+145% ROI</p>
          </div>
        </div>
        <button
          type="button"
          tabIndex={-1}
          className="mt-3 w-full animate-pulse rounded-lg bg-accent py-1.5 text-[11px] font-bold text-accent-foreground"
        >
          نسخ الصفقة
        </button>
      </div>
      <div className="mt-2 space-y-2">
        {["سارة أحمد", "محمد ناصر"].map((name) => (
          <div key={name} className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-2">
            <span className="text-[11px] text-white">{name}</span>
            <span className="text-[11px] font-semibold text-success">+{62 + name.length}%</span>
          </div>
        ))}
      </div>
    </SceneWrap>
  );
}

function PortfolioScene({ active }: { active: boolean }) {
  return (
    <SceneWrap active={active}>
      <p className="text-xs font-semibold text-white">المحفظة الحية</p>
      <svg viewBox="0 0 220 100" className="mt-3 h-24 w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="heroMockupFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4ade80" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#4ade80" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points="0,100 0,70 25,74 50,55 75,60 100,35 125,42 150,20 175,28 200,10 220,15 220,100" fill="url(#heroMockupFill)" />
        <polyline
          points="0,70 25,74 50,55 75,60 100,35 125,42 150,20 175,28 200,10 220,15"
          fill="none"
          stroke="#4ade80"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-success/20 bg-success/10 px-2.5 py-2">
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
        <p className="text-[11px] text-success">صفقة XAUUSD أغلقت بربح +$320</p>
      </div>
    </SceneWrap>
  );
}
