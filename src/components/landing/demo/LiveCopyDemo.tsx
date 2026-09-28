"use client";

import { memo, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useOnScreen } from "@/components/landing/useInView";

// Illustrative trading panel: candles + a repeating copy-trade scenario. Only
// transform / opacity animate (candles slide left, the price line moves, markers
// and the toast fade); numbers are plain text updates. All data is fixed sample
// data: 1.00 lot on gold = 100 oz, so a 4.82 move is $482 for the trader and
// $48.20 for a 10% (0.10 lot) copy.

const W = 400;
const H = 190;
const N = 40; // visible candles
const CW = 10; // candle spacing (x units)
const BASE = 4140;
const HALF = 6.5; // half price range shown
const MOVE = 4.82;
const CYCLE = 10600;
const TICK = 200;
const CANDLE_EVERY = 6; // ticks -> 1.2s

const yOf = (p: number) => H / 2 - ((p - BASE) / HALF) * (H / 2 - 10);
const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Candle = { id: number; o: number; h: number; l: number; c: number };

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedCandles(): Candle[] {
  const rnd = mulberry32(11);
  const out: Candle[] = [];
  let p = BASE - 1;
  for (let i = 0; i < N; i++) {
    const o = p;
    p = Math.min(BASE + 3.5, Math.max(BASE - 4.5, p + (rnd() - 0.5) * 2.4 + (BASE - 1.5 - p) * 0.1));
    out.push({ id: i, o, c: p, h: Math.max(o, p) + rnd() * 0.7, l: Math.min(o, p) - rnd() * 0.7 });
  }
  return out;
}

const INITIAL = seedCandles();
const STATIC_ENTRY = BASE - 2.4;

const Candles = memo(function Candles({ candles }: { candles: Candle[] }) {
  return (
    <>
      {candles.map((c) => {
        const up = c.c >= c.o;
        const top = yOf(Math.max(c.o, c.c));
        const bot = yOf(Math.min(c.o, c.c));
        const x = c.id * CW + CW / 2;
        const color = up ? "var(--up)" : "var(--down)";
        return (
          <g key={c.id}>
            <line x1={x} x2={x} y1={yOf(c.h)} y2={yOf(c.l)} stroke={color} strokeWidth="1" />
            <rect x={x - 3} y={top} width="6" height={Math.max(1.5, bot - top)} fill={color} />
          </g>
        );
      })}
    </>
  );
});

type Sim = {
  t: number;
  ticks: number;
  price: number;
  entry: number | null;
  entryX: number;
  copied: boolean;
  closed: boolean;
  candles: Candle[];
  o: number;
  hi: number;
  lo: number;
};

const INITIAL_SIM: Sim = {
  t: 0,
  ticks: 0,
  price: BASE - 1.5,
  entry: null,
  entryX: 0,
  copied: false,
  closed: false,
  candles: INITIAL,
  o: BASE - 1.5,
  hi: BASE - 1.5,
  lo: BASE - 1.5,
};

function step(s: Sim): Sim {
  const next = { ...s };
  next.t = (s.t + TICK) % CYCLE;
  next.ticks = s.ticks + 1;
  const t = next.t;
  if (t < TICK) {
    // A new cycle starts: markers disappear, price drifts back.
    next.entry = null;
    next.copied = false;
    next.closed = false;
  }
  const noise = (Math.random() - 0.5) * 1.2;
  if (next.entry === null && t >= 1400 && t < 8000) {
    next.entry = Math.min(BASE + 1, Math.max(BASE - 3.5, s.price));
    next.entryX = (s.candles[s.candles.length - 1].id + 1) * CW + CW / 2;
  }
  if (!next.copied && t >= 2000 && next.entry !== null) next.copied = true;

  if (next.entry !== null && t < 8000) {
    const prog = Math.max(0, Math.min(1, (t - 1400) / 6600));
    next.price = next.entry + MOVE * (prog * prog * (3 - 2 * prog)) + noise * (1 - prog);
  } else if (next.entry !== null) {
    next.closed = true;
    next.price = t === 8000 ? next.entry + MOVE : s.price + (BASE - 1.5 - s.price) * 0.12 + noise;
  } else {
    next.price = s.price + (BASE - 2.2 - s.price) * 0.15 + noise;
  }
  if (t === 8000 && next.entry !== null) next.price = next.entry + MOVE;
  next.price = Math.min(BASE + 6, Math.max(BASE - 6, next.price));
  next.hi = Math.max(s.hi, next.price);
  next.lo = Math.min(s.lo, next.price);

  if (next.ticks % CANDLE_EVERY === 0) {
    const last = s.candles[s.candles.length - 1];
    const c: Candle = { id: last.id + 1, o: s.o, c: next.price, h: next.hi, l: next.lo };
    next.candles = [...s.candles.slice(1 - N), c];
    next.o = next.price;
    next.hi = next.price;
    next.lo = next.price;
  }
  return next;
}

export function LiveCopyDemo() {
  const t = useTranslations("Landing");
  const { ref, visible, reduced } = useOnScreen<HTMLDivElement>();
  const [sim, setSim] = useState<Sim>(INITIAL_SIM);
  const simRef = useRef(sim);

  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => {
      simRef.current = step(simRef.current);
      setSim(simRef.current);
    }, TICK);
    return () => clearInterval(id);
  }, [visible]);

  // Reduced motion: the last state of the scenario, held still.
  const s: Sim = reduced
    ? { ...sim, price: STATIC_ENTRY + MOVE, entry: STATIC_ENTRY, entryX: (N - 6) * CW + CW / 2, copied: true, closed: true }
    : sim;
  const lastId = s.candles[s.candles.length - 1].id;
  const shift = (lastId - (N - 1)) * CW;
  const target = s.entry !== null ? s.entry + MOVE : null;
  const profit = s.entry !== null ? (s.price - s.entry) * 100 : 0; // trader, 1.00 lot
  const mine = profit * 0.1;
  const name = t("demoTraderName");

  return (
    <div ref={ref} className="relative w-full max-w-[540px] rounded-2xl border border-border-strong bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4" dir="ltr">
        <div className="flex items-baseline gap-3">
          <span className="text-sm font-semibold">
            XAUUSD<span className="mx-1.5 text-muted">{"·"}</span>15m
          </span>
          <span className="num text-xl font-semibold">{fmt(s.price)}</span>
        </div>
        <span className="rounded-md border border-border-strong bg-surface-2 px-2 py-0.5 text-xs text-muted" dir="auto">
          {t("demoBadge")}
        </span>
      </div>

      <div className="relative px-2 pt-3" dir="ltr">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full overflow-hidden" role="img" aria-label={t("demoChartAlt")}>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="var(--border)" strokeWidth="1" />
          ))}
          <g style={{ transform: `translateX(${-shift}px)`, transition: "transform 400ms ease-out" }}>
            <Candles candles={s.candles} />
            {s.entry !== null && (
              <g>
                <circle cx={s.entryX} cy={yOf(s.entry)} r="3.5" fill="var(--primary)" />
                <g transform={`translate(${s.entryX - 8}, ${yOf(s.entry) - 26})`}>
                  <rect x={-118} y="0" width="118" height="17" rx="4" fill="var(--surface-2)" stroke="var(--border-strong)" />
                  <text x={-59} y="11.5" textAnchor="middle" fontSize="9" fill="var(--foreground)">
                    {t("demoOpened", { name })}
                  </text>
                </g>
              </g>
            )}
            {s.copied && s.entry !== null && (
              <g>
                <circle cx={s.entryX + CW} cy={yOf(s.entry + 0.9)} r="3.5" fill="var(--up)" />
                <g transform={`translate(${s.entryX + CW - 8}, ${yOf(s.entry) + 12})`}>
                  <rect x={-160} y="0" width="160" height="17" rx="4" fill="var(--surface-2)" stroke="var(--up)" />
                  <text x={-80} y="11.5" textAnchor="middle" fontSize="9" fill="var(--foreground)">
                    {t("demoCopied")}
                  </text>
                </g>
              </g>
            )}
          </g>
          {s.entry !== null && (
            <line x1="0" x2={W} y1={yOf(s.entry)} y2={yOf(s.entry)} stroke="var(--muted)" strokeWidth="1" strokeDasharray="4 4" />
          )}
          {target !== null && <line x1="0" x2={W} y1={yOf(target)} y2={yOf(target)} stroke="var(--up)" strokeWidth="1" />}
          <line
            x1="0"
            x2={W}
            y1="0"
            y2="0"
            stroke="var(--primary)"
            strokeWidth="1"
            style={{ transform: `translateY(${yOf(s.price)}px)`, transition: "transform 200ms linear" }}
          />
        </svg>

        <div
          className="pointer-events-none absolute start-4 top-4 rounded-lg border border-up bg-surface-2 px-3 py-1.5 text-sm font-medium text-up"
          style={{ opacity: s.closed ? 1 : 0, transform: `translateY(${s.closed ? 0 : -6}px)`, transition: "opacity 300ms, transform 300ms" }}
          dir="rtl"
          aria-live="polite"
        >
          {t("demoClosed", { amount: "+$48.20" })}
        </div>
      </div>

      <div className="grid gap-2 border-t border-border px-5 py-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted">{t("demoTraderRow")}</span>
          <span className={`num font-semibold ${profit >= 0 ? "text-up" : "text-down"}`}>
            {profit >= 0 ? "+" : "-"}${fmt(Math.abs(profit))}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted">{t("demoYourRow")}</span>
          <span className={`num font-semibold ${mine >= 0 ? "text-up" : "text-down"}`}>
            {s.copied ? `${mine >= 0 ? "+" : "-"}$${fmt(Math.abs(mine))}` : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}
