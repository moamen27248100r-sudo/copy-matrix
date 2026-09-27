"use client";

import { useEffect, useRef, useState } from "react";

const SCENE_MS = [1800, 2600, 2800, 2400];
const SCENE_COUNT = 4;
const DEMO_EMAIL = "user@copymatrix.com";
const DEMO_PASSWORD = "••••••••";

export function HeroPhoneMockup() {
  const [scene, setScene] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => setScene((s) => (s + 1) % SCENE_COUNT), SCENE_MS[scene]);
    return () => clearTimeout(id);
  }, [scene]);

  return (
    <div className="relative mx-auto w-full max-w-2xl px-4 pb-24 pt-10">
      {/* soft light backdrop plate the device "sits" on, like a product shot */}
      <div
        className="pointer-events-none absolute inset-x-0 top-6 -z-10 mx-auto h-[380px] w-[380px] rounded-[50%] blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(226,232,240,0.16), rgba(148,163,184,0.08) 55%, transparent 75%)" }}
      />

      <div
        className="relative mx-auto w-[250px] transition-transform duration-700 ease-in-out sm:w-[290px]"
        style={{
          transform: scene === 2 ? "scale(1.12)" : "scale(1)",
          maskImage: "linear-gradient(to bottom, black 86%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 86%, transparent 100%)",
        }}
      >
        <div className="relative rounded-[2.6rem] bg-gradient-to-br from-slate-400 via-slate-800 to-slate-950 p-[2.5px] shadow-[0_40px_70px_-18px_rgba(0,0,0,0.75)]">
          <div className="relative h-[420px] overflow-hidden rounded-[2.45rem] border border-black/60">
            <span className="absolute inset-x-0 top-2.5 z-30 mx-auto block h-6 w-28 rounded-full bg-black" />
            <div
              className="pointer-events-none absolute inset-0 z-20"
              style={{ background: "linear-gradient(115deg, rgba(255,255,255,0.08) 0%, transparent 18%, transparent 82%, rgba(255,255,255,0.05) 100%)" }}
            />

            <SplashScene active={scene === 0} />
            <OnboardingScene active={scene === 1} />
            <LoginScene active={scene === 2} />
            <DashboardScene active={scene === 3} />

            <span
              className={
                "absolute inset-x-0 bottom-1.5 z-30 mx-auto block h-1 w-24 rounded-full transition-colors " +
                (scene === 1 ? "bg-black/25" : "bg-white/70")
              }
            />
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

function SceneWrap({ active, light, children }: { active: boolean; light?: boolean; children: React.ReactNode }) {
  return (
    <div
      className={
        "absolute inset-0 flex flex-col px-3.5 pt-9 transition-all duration-700 ease-out " +
        (light ? "bg-white " : "bg-[#0b0e14] ") +
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
        "absolute inset-0 flex flex-col items-center justify-center gap-3 pt-9 transition-opacity duration-700 " +
        (active ? "opacity-100" : "pointer-events-none opacity-0")
      }
      style={{ background: "#0f685c" }}
    >
      <p className={"text-2xl font-extrabold text-white transition-all duration-1000 " + (active ? "scale-100 opacity-100" : "scale-90 opacity-0")}>
        Copy Matrix
      </p>
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-white/80" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  );
}

function OnboardingScene({ active }: { active: boolean }) {
  return (
    <SceneWrap active={active} light>
      <p className="text-center text-[15px] font-extrabold leading-snug text-slate-900">
        انسخ صفقات أفضل المتداولين تلقائيًا
      </p>
      <div className="mt-3.5 grid grid-cols-2 gap-2">
        {[
          { sym: "BTC", pct: "+3.2%" },
          { sym: "ETH", pct: "+2.1%" },
        ].map((c) => (
          <div key={c.sym} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
            <p className="text-[11px] font-semibold text-slate-500" dir="ltr">{c.sym}</p>
            <p className="text-xs font-bold text-emerald-600" dir="ltr">{c.pct}</p>
          </div>
        ))}
      </div>
      <div className="relative mt-auto mb-8">
        <span className="block w-full rounded-lg bg-accent py-2 text-center text-[11px] font-bold text-white">ابدأ الآن</span>
        <span className="pointer-events-none absolute end-6 -top-1 flex h-6 w-6 items-center justify-center">
          <span className="absolute h-6 w-6 animate-ping rounded-full bg-slate-900/30" />
          <span className="relative h-3 w-3 rounded-full border-2 border-slate-900 bg-white shadow-lg" />
        </span>
      </div>
    </SceneWrap>
  );
}

function useTypewriter(active: boolean, text: string, speed: number, startDelay: number) {
  const [out, setOut] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!active) {
      setOut("");
      return;
    }
    let i = 0;
    const tick = () => {
      i += 1;
      setOut(text.slice(0, i));
      if (i < text.length) timer.current = setTimeout(tick, speed);
    };
    timer.current = setTimeout(tick, startDelay);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return out;
}

function LoginScene({ active }: { active: boolean }) {
  const email = useTypewriter(active, DEMO_EMAIL, 55, 250);
  const password = useTypewriter(active, DEMO_PASSWORD, 70, 1500);
  const pressed = active && password.length === DEMO_PASSWORD.length;

  return (
    <SceneWrap active={active} light>
      <p className="text-center text-sm font-extrabold text-slate-900">تسجيل الدخول</p>
      <div className="mt-5 space-y-2.5">
        <div className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-700" dir="ltr">
          {email}
          <span className="animate-pulse">{email.length < DEMO_EMAIL.length ? "|" : ""}</span>
        </div>
        <div className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-2 text-[11px] tracking-widest text-slate-700" dir="ltr">
          {password}
        </div>
      </div>
      <span
        className={
          "mt-4 block w-full rounded-lg py-2 text-center text-[11px] font-bold text-white transition-colors " +
          (pressed ? "bg-accent-hover" : "bg-accent")
        }
      >
        دخول
      </span>
    </SceneWrap>
  );
}

function DashboardScene({ active }: { active: boolean }) {
  return (
    <SceneWrap active={active}>
      <p className="text-xs font-semibold text-white">رصيدك الحالي</p>
      <p className="mt-1 text-2xl font-extrabold text-white" dir="ltr">$12,480</p>
      <svg viewBox="0 0 220 90" className="mt-3 h-20 w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="heroDashFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4ade80" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#4ade80" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points="0,90 0,65 30,68 60,50 90,55 120,32 150,38 180,15 220,20 220,90" fill="url(#heroDashFill)" />
        <polyline
          points="0,65 30,68 60,50 90,55 120,32 150,38 180,15 220,20"
          fill="none"
          stroke="#4ade80"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-success/20 bg-success/10 px-2.5 py-2">
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
        <p className="text-[11px] text-success">أرباح اليوم +$320</p>
      </div>
    </SceneWrap>
  );
}
