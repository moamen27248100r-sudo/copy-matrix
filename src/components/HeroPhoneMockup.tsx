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

// Full, uncut 3D-tilted phone frame -- no bottom mask -- with a dark
// trading-dashboard screen (candlesticks + a glowing trend line, a
// pulsing "copy trades" button, and a softly looping profit toast).
// Pure CSS/Tailwind animations only, no per-scene JS state machine.
export function HeroPhoneMockup() {
  return (
    <div className="relative mx-auto w-full max-w-2xl px-4 pb-16 pt-10" style={{ perspective: "1400px" }}>
      <div
        className="pointer-events-none absolute inset-0 -z-10 mx-auto h-[460px] w-[460px] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(34,211,238,0.32), rgba(30,64,175,0.2) 45%, transparent 72%)" }}
      />

      <div
        className="relative mx-auto w-[260px] sm:w-[300px]"
        style={{ transform: "rotateX(6deg) rotateY(-12deg)", transformStyle: "preserve-3d" }}
      >
        {/* side buttons */}
        <span className="absolute -start-[3px] top-24 h-8 w-[3px] rounded-s-sm bg-slate-700" />
        <span className="absolute -start-[3px] top-36 h-12 w-[3px] rounded-s-sm bg-slate-700" />
        <span className="absolute -end-[3px] top-28 h-16 w-[3px] rounded-e-sm bg-slate-700" />

        <div className="relative rounded-[2.9rem] bg-gradient-to-br from-slate-400 via-slate-800 to-slate-950 p-[3px] shadow-[0_45px_80px_-15px_rgba(8,145,178,0.35)]">
          <div className="relative overflow-hidden rounded-[2.75rem] border border-black/60 bg-[#090D16]">
            <span className="absolute inset-x-0 top-2.5 z-30 mx-auto block h-6 w-28 rounded-full bg-black" />
            <div
              className="pointer-events-none absolute inset-0 z-20"
              style={{ background: "linear-gradient(115deg, rgba(255,255,255,0.07) 0%, transparent 18%, transparent 82%, rgba(255,255,255,0.04) 100%)" }}
            />

            <div className="relative flex h-[460px] flex-col px-3.5 pb-6 pt-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-muted" dir="ltr">XAUUSD</p>
                  <p className="text-lg font-extrabold text-white" dir="ltr">$2,486.30</p>
                </div>
                <span className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-[10px] font-semibold text-success">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                  +2.9%
                </span>
              </div>

              <div className="relative mt-4 h-32 w-full">
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
                    stroke="#22d3ee"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.85"
                    style={{ filter: "drop-shadow(0 0 4px rgba(34,211,238,0.9))" }}
                  />
                </svg>
              </div>

              <div className="relative mt-5">
                <span className="block w-full animate-pulse rounded-lg bg-accent py-2.5 text-center text-[11px] font-bold text-accent-foreground shadow-lg shadow-accent/30">
                  نسخ الصفقات تلقائيًا
                </span>
              </div>

              <div className="mt-3 flex items-center gap-2 rounded-lg border border-success/20 bg-success/10 px-2.5 py-2 animate-[heroToast_3.2s_ease-in-out_infinite]">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                <p className="text-[11px] text-success">صفقة XAUUSD أغلقت بربح +$320</p>
              </div>

              <div className="mt-auto flex items-center justify-between text-[10px] text-muted">
                <span>سجل الصفقات</span>
                <span className="text-white">المحفظة</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes heroToast {
          0%, 100% { opacity: 0.55; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-2px); }
        }
      `}</style>
    </div>
  );
}
