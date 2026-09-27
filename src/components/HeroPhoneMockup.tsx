"use client";

import { useEffect, useState } from "react";

const SCENE_MS = 2600;
const SCENE_COUNT = 4;

export function HeroPhoneMockup() {
  const [scene, setScene] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setScene((s) => (s + 1) % SCENE_COUNT), SCENE_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-2xl px-4 pb-24 pt-10" style={{ perspective: "1400px" }}>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-[440px] w-[440px] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(34,211,238,0.3), rgba(30,64,175,0.2) 45%, transparent 72%)" }}
      />

      <div
        className="relative mx-auto w-[250px] sm:w-[290px]"
        style={{
          maskImage: "linear-gradient(to bottom, black 86%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 86%, transparent 100%)",
        }}
      >
        {/* Metallic bezel + deep drop shadow so the device floats over the page */}
        <div
          className="relative rounded-[2.9rem] bg-gradient-to-br from-slate-500 via-slate-800 to-slate-950 p-[3px] shadow-[0_35px_60px_-15px_rgba(0,0,0,0.7)]"
          style={{ transform: "rotateY(-15deg) rotateX(4deg)", transformStyle: "preserve-3d" }}
        >
          <div className="relative overflow-hidden rounded-[2.75rem] border border-black/60 bg-slate-950 shadow-inner shadow-cyan-500/10">
            <span className="absolute inset-x-0 top-2.5 z-20 mx-auto block h-6 w-28 rounded-full bg-black" />
            {/* subtle diagonal glass reflection */}
            <div
              className="pointer-events-none absolute inset-0 z-10"
              style={{ background: "linear-gradient(115deg, rgba(255,255,255,0.08) 0%, transparent 18%, transparent 82%, rgba(255,255,255,0.05) 100%)" }}
            />

            <div className="relative h-[420px] overflow-hidden pt-9">
              <SplashScene active={scene === 0} />
              <SignalsScene active={scene === 1} />
              <TapScene active={scene === 2} />
              <AccountScene active={scene === 3} />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-1.5">
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
            <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-accent" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </SceneWrap>
  );
}

const SIGNALS = [
  { sym: "XAUUSD", pct: 78 },
  { sym: "BTCUSDT", pct: 64 },
  { sym: "ETHUSDT", pct: 52 },
];

function SignalsScene({ active }: { active: boolean }) {
  return (
    <SceneWrap active={active}>
      <p className="text-xs font-semibold text-white">توصيات نسخ حية</p>
      <div className="mt-3 space-y-2.5">
        {SIGNALS.map((s) => (
          <div key={s.sym} className="rounded-lg border border-white/[0.07] bg-white/[0.04] px-2.5 py-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-white" dir="ltr">{s.sym}</span>
              <span className="text-[11px] font-semibold text-success">+{s.pct / 4}%</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={"h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-all duration-[1400ms] ease-out " + (active ? "" : "!w-0")}
                style={{ width: active ? `${s.pct}%` : "0%" }}
              />
            </div>
          </div>
        ))}
      </div>
    </SceneWrap>
  );
}

function TapScene({ active }: { active: boolean }) {
  return (
    <SceneWrap active={active}>
      <p className="text-xs font-semibold text-white">نسخ التوصية</p>
      <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.05] p-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-white" dir="ltr">XAUUSD</span>
          <span className="text-[11px] font-semibold text-success">+19.5%</span>
        </div>
        <div className="relative mt-3">
          <span className="block w-full rounded-lg bg-accent py-2 text-center text-[11px] font-bold text-accent-foreground">
            نسخ التوصية تلقائيًا
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

function AccountScene({ active }: { active: boolean }) {
  return (
    <SceneWrap active={active}>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/15 text-accent">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 7v10M7 12h10" />
          </svg>
        </span>
        <p className="text-[13px] font-semibold text-white">أنشئ حسابك وتابع محفظتك الحية</p>
        <div className="rounded-lg border border-success/20 bg-success/10 px-3 py-1.5">
          <p className="text-sm font-extrabold text-success" dir="ltr">+$320</p>
        </div>
      </div>
    </SceneWrap>
  );
}
