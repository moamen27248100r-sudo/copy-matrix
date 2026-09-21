// Deterministic avatar generator: the same seed always produces the same
// picture, with no image files, no third-party service, and nobody real in
// it. Every avatar is a price chart drawn from freshly random market data
// (candlesticks, OHLC bars, line / area / step / baseline charts, histograms,
// Bollinger bands, Renko bricks, P&L bars) on a vivid gradient background with
// a glow, optional volume / moving average, and an instrument tag. Chart type x
// palette x random series x overlays means neighbouring leaders almost never
// look alike.
// Everything is drawn on a 128x128 square; the UI clips it to a circle, so the
// artwork stays inside the inscribed area.

import { generateInitialsSvg } from "@/lib/avatar-initials";

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;
const pick = <T,>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)];
const f = (n: number) => Math.round(n * 10) / 10;

// Vivid gradient backgrounds (from, to).
const BACKGROUNDS: readonly (readonly [string, string])[] = [
  ["#2547d0", "#7c2ff0"],
  ["#0e8a86", "#0a1f4a"],
  ["#d61f7a", "#3b0a78"],
  ["#e2560f", "#5a0a2a"],
  ["#0c9a68", "#053a3a"],
  ["#0a84d6", "#1b1466"],
  ["#5b3df0", "#0a1330"],
  ["#c026d3", "#241a6e"],
  ["#0ea5c4", "#0a3a2e"],
  ["#d98a0a", "#3a1408"],
  ["#1d63f0", "#0a4a7a"],
  ["#17a34a", "#062a1a"],
  ["#d11d4a", "#231762"],
  ["#1a2340", "#0a0f1f"],
];

// Bright candle / line colours (up, down) that stay readable on the above.
const SCHEMES: readonly (readonly [string, string])[] = [
  ["#19f0a4", "#ff4d6d"],
  ["#2dffb4", "#ff5c7a"],
  ["#00e5ff", "#ff5cb0"],
  ["#a6ff4d", "#ff7a3d"],
  ["#4dffb8", "#ffdf4d"],
  ["#5cf2ff", "#ff6b6b"],
];
const ACCENTS = ["#ffffff", "#ffd84d", "#7de0ff", "#f5a8ff", "#b6ff8a"] as const;
const TICKERS = [
  "EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "XAGUSD", "BTCUSD", "ETHUSD", "US30", "NAS100",
  "SPX500", "GER40", "USOIL", "AUDUSD", "USDCAD", "SOLUSD", "USDCHF", "NZDUSD", "EURJPY",
] as const;

const FONT = `font-family="Arial, Helvetica, sans-serif" font-weight="700"`;

type Ctx = {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  up: string;
  down: string;
  accent: string;
  bullish: boolean;
};

type Candle = { o: number; h: number; l: number; c: number };

// Random-walk OHLC series; bullish series drift up.
function candleSeries(rng: Rng, n: number, bullish: boolean): Candle[] {
  const drift = (bullish ? 1 : -1) * (0.08 + rng() * 0.16);
  const swing = 0.7 + rng() * 0.9;
  let prev = 0;
  const out: Candle[] = [];
  for (let i = 0; i < n; i++) {
    const c = prev + (rng() - 0.5 + drift) * swing;
    const hi = Math.max(prev, c) + rng() * 0.45;
    const lo = Math.min(prev, c) - rng() * 0.45;
    out.push({ o: prev, h: hi, l: lo, c });
    prev = c;
  }
  return out;
}

function lineSeries(rng: Rng, n: number, bullish: boolean): number[] {
  return candleSeries(rng, n, bullish).map((k) => k.c);
}

function scaler(values: number[], y0: number, y1: number) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return (v: number) => y1 - ((v - min) / span) * (y1 - y0);
}

const path = (pts: [number, number][]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${f(x)} ${f(y)}`).join(" ");
const smooth = (vals: number[], w: number) =>
  vals.map((_, i) => {
    const s = vals.slice(Math.max(0, i - w + 1), i + 1);
    return s.reduce((a, b) => a + b, 0) / s.length;
  });

// ---------- chart bodies ----------

function candles(rng: Rng, c: Ctx, opts: { ma: boolean; volume: boolean }): string {
  const n = 8 + Math.floor(rng() * 4);
  const data = candleSeries(rng, n, c.bullish);
  const yTop = c.y0;
  const yBot = opts.volume ? c.y1 - 14 : c.y1;
  const sc = scaler(data.flatMap((k) => [k.h, k.l]), yTop, yBot);
  const step = (c.x1 - c.x0) / n;
  const w = Math.max(4, step * 0.58);
  let out = "";
  data.forEach((k, i) => {
    const up = k.c >= k.o;
    const col = up ? c.up : c.down;
    const x = c.x0 + i * step + (step - w) / 2;
    const top = sc(Math.max(k.o, k.c));
    const bot = sc(Math.min(k.o, k.c));
    out += `<line x1="${f(x + w / 2)}" y1="${f(sc(k.h))}" x2="${f(x + w / 2)}" y2="${f(sc(k.l))}" stroke="${col}" stroke-width="1.8" stroke-linecap="round"/>`;
    out += `<rect x="${f(x)}" y="${f(top)}" width="${f(w)}" height="${f(Math.max(2.5, bot - top))}" rx="1.6" fill="${col}"/>`;
    if (opts.volume) {
      const vh = 3 + rng() * 11;
      out += `<rect x="${f(x)}" y="${f(c.y1 - vh)}" width="${f(w)}" height="${f(vh)}" rx="1" fill="${col}" opacity=".45"/>`;
    }
  });
  if (opts.ma) {
    const ma = smooth(data.map((k) => k.c), 3);
    const pts = ma.map((v, i): [number, number] => [c.x0 + i * step + step / 2, sc(v)]);
    out += `<path d="${path(pts)}" fill="none" stroke="${c.accent}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" filter="url(#gl)"/>`;
  }
  return out;
}

function ohlc(rng: Rng, c: Ctx): string {
  const n = 8 + Math.floor(rng() * 4);
  const data = candleSeries(rng, n, c.bullish);
  const sc = scaler(data.flatMap((k) => [k.h, k.l]), c.y0, c.y1);
  const step = (c.x1 - c.x0) / n;
  let out = "";
  data.forEach((k, i) => {
    const col = k.c >= k.o ? c.up : c.down;
    const x = c.x0 + i * step + step / 2;
    out += `<g stroke="${col}" stroke-width="2.4" stroke-linecap="round"><line x1="${f(x)}" y1="${f(sc(k.h))}" x2="${f(x)}" y2="${f(sc(k.l))}"/><line x1="${f(x - step * 0.4)}" y1="${f(sc(k.o))}" x2="${f(x)}" y2="${f(sc(k.o))}"/><line x1="${f(x)}" y1="${f(sc(k.c))}" x2="${f(x + step * 0.4)}" y2="${f(sc(k.c))}"/></g>`;
  });
  return out;
}

function linePoints(rng: Rng, c: Ctx, n: number): [number, number][] {
  const vals = lineSeries(rng, n, c.bullish);
  const sc = scaler(vals, c.y0, c.y1);
  const step = (c.x1 - c.x0) / (n - 1);
  return vals.map((v, i): [number, number] => [c.x0 + i * step, sc(v)]);
}

function line(rng: Rng, c: Ctx): string {
  const pts = linePoints(rng, c, 12 + Math.floor(rng() * 8));
  const col = c.bullish ? c.up : c.down;
  const last = pts[pts.length - 1];
  let out = `<defs><linearGradient id="fa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".5"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>`;
  out += `<path d="${path(pts)} L${f(last[0])} ${c.y1 + 8} L${f(pts[0][0])} ${c.y1 + 8}z" fill="url(#fa)"/>`;
  out += `<path d="${path(pts)}" fill="none" stroke="${c.accent}" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" filter="url(#gl)"/>`;
  out += `<circle cx="${f(last[0])}" cy="${f(last[1])}" r="5" fill="${col}" stroke="#fff" stroke-width="2.4"/>`;
  return out;
}

function area(rng: Rng, c: Ctx): string {
  const pts = linePoints(rng, c, 16 + Math.floor(rng() * 8));
  const col = c.bullish ? c.up : c.down;
  let out = `<defs><linearGradient id="fa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".85"/><stop offset="1" stop-color="${col}" stop-opacity=".05"/></linearGradient></defs>`;
  out += `<path d="${path(pts)} L${f(pts[pts.length - 1][0])} ${c.y1 + 8} L${f(pts[0][0])} ${c.y1 + 8}z" fill="url(#fa)"/>`;
  out += `<path d="${path(pts)}" fill="none" stroke="${col}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" filter="url(#gl)"/>`;
  return out;
}

function step(rng: Rng, c: Ctx): string {
  const n = 9 + Math.floor(rng() * 4);
  const vals = lineSeries(rng, n, c.bullish);
  const sc = scaler(vals, c.y0, c.y1);
  const sx = (c.x1 - c.x0) / n;
  let d = `M${f(c.x0)} ${f(sc(vals[0]))}`;
  vals.forEach((v, i) => {
    d += ` L${f(c.x0 + i * sx)} ${f(sc(v))} L${f(c.x0 + (i + 1) * sx)} ${f(sc(v))}`;
  });
  return `<path d="${d}" fill="none" stroke="${c.accent}" stroke-width="3.4" stroke-linejoin="round" stroke-linecap="round" filter="url(#gl)"/>`;
}

function histogram(rng: Rng, c: Ctx): string {
  const n = 10 + Math.floor(rng() * 4);
  const vals = lineSeries(rng, n, c.bullish);
  const sc = scaler(vals, c.y0 + 6, c.y1);
  const sx = (c.x1 - c.x0) / n;
  let out = "";
  vals.forEach((v, i) => {
    const up = i === 0 || v >= vals[i - 1];
    const y = sc(v);
    out += `<rect x="${f(c.x0 + i * sx + 1)}" y="${f(y)}" width="${f(sx - 2.5)}" height="${f(c.y1 - y + 6)}" rx="2" fill="${up ? c.up : c.down}"/>`;
  });
  const pts = vals.map((v, i): [number, number] => [c.x0 + i * sx + sx / 2, sc(v) - 5]);
  out += `<path d="${path(pts)}" fill="none" stroke="${c.accent}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" filter="url(#gl)"/>`;
  return out;
}

function pnlBars(rng: Rng, c: Ctx): string {
  const n = 9 + Math.floor(rng() * 4);
  const mid = (c.y0 + c.y1) / 2;
  const half = (c.y1 - c.y0) / 2;
  const sx = (c.x1 - c.x0) / n;
  let out = `<line x1="${c.x0}" y1="${f(mid)}" x2="${c.x1}" y2="${f(mid)}" stroke="#fff" stroke-opacity=".45" stroke-width="1.5" stroke-dasharray="3 3"/>`;
  for (let i = 0; i < n; i++) {
    const win = rng() < (c.bullish ? 0.68 : 0.36);
    const h = (0.2 + rng() * 0.8) * half * (win ? 1 : 0.7);
    out += `<rect x="${f(c.x0 + i * sx + 1)}" y="${f(win ? mid - h : mid)}" width="${f(sx - 2.5)}" height="${f(h)}" rx="2" fill="${win ? c.up : c.down}"/>`;
  }
  return out;
}

function baseline(rng: Rng, c: Ctx): string {
  const pts = linePoints(rng, c, 16 + Math.floor(rng() * 6));
  const mid = (c.y0 + c.y1) / 2;
  const d = `${path(pts)} L${f(pts[pts.length - 1][0])} ${f(mid)} L${f(pts[0][0])} ${f(mid)}z`;
  let out = `<defs><clipPath id="ca"><rect x="0" y="0" width="128" height="${f(mid)}"/></clipPath><clipPath id="cb"><rect x="0" y="${f(mid)}" width="128" height="128"/></clipPath></defs>`;
  out += `<path d="${d}" fill="${c.up}" opacity=".7" clip-path="url(#ca)"/><path d="${d}" fill="${c.down}" opacity=".7" clip-path="url(#cb)"/>`;
  out += `<line x1="${c.x0}" y1="${f(mid)}" x2="${c.x1}" y2="${f(mid)}" stroke="#fff" stroke-opacity=".5" stroke-dasharray="3 3"/>`;
  out += `<path d="${path(pts)}" fill="none" stroke="${c.accent}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" filter="url(#gl)"/>`;
  return out;
}

function bollinger(rng: Rng, c: Ctx): string {
  const n = 14 + Math.floor(rng() * 5);
  const vals = lineSeries(rng, n, c.bullish);
  const ma = smooth(vals, 4);
  const band = 0.5 + rng() * 0.5;
  const all = [...vals, ...ma.map((v) => v + band), ...ma.map((v) => v - band)];
  const sc = scaler(all, c.y0, c.y1);
  const sx = (c.x1 - c.x0) / (n - 1);
  const X = (i: number) => c.x0 + i * sx;
  const upper = ma.map((v, i): [number, number] => [X(i), sc(v + band)]);
  const lower = ma.map((v, i): [number, number] => [X(i), sc(v - band)]);
  let out = `<path d="${path(upper)} ${path([...lower].reverse()).replace("M", "L")}z" fill="${c.accent}" opacity=".16"/>`;
  out += `<path d="${path(upper)}" fill="none" stroke="${c.accent}" stroke-opacity=".7" stroke-width="1.6"/><path d="${path(lower)}" fill="none" stroke="${c.accent}" stroke-opacity=".7" stroke-width="1.6"/>`;
  out += `<path d="${path(vals.map((v, i): [number, number] => [X(i), sc(v)]))}" fill="none" stroke="${c.bullish ? c.up : c.down}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" filter="url(#gl)"/>`;
  return out;
}

function renko(rng: Rng, c: Ctx): string {
  const n = 9 + Math.floor(rng() * 3);
  const sx = (c.x1 - c.x0) / n;
  const bh = 8;
  let level = 0;
  const levels: { lv: number; up: boolean }[] = [];
  for (let i = 0; i < n; i++) {
    const up = rng() < (c.bullish ? 0.7 : 0.32);
    level += up ? 1 : -1;
    levels.push({ lv: level, up });
  }
  const min = Math.min(...levels.map((l) => l.lv));
  const max = Math.max(...levels.map((l) => l.lv));
  const unit = Math.min(bh + 2, (c.y1 - c.y0) / Math.max(1, max - min + 1));
  let out = "";
  levels.forEach(({ lv, up }, i) => {
    const y = c.y1 - (lv - min + 1) * unit;
    out += `<rect x="${f(c.x0 + i * sx + 0.8)}" y="${f(y)}" width="${f(sx - 1.6)}" height="${f(unit - 1.4)}" rx="1.6" fill="${up ? c.up : c.down}"/>`;
  });
  return out;
}

// ---------- assembly ----------

const BODIES: readonly ((rng: Rng, c: Ctx) => string)[] = [
  (r, c) => candles(r, c, { ma: r() < 0.55, volume: r() < 0.4 }),
  (r, c) => candles(r, c, { ma: r() < 0.55, volume: r() < 0.4 }),
  (r, c) => candles(r, c, { ma: true, volume: r() < 0.5 }),
  ohlc,
  line,
  line,
  area,
  area,
  step,
  histogram,
  pnlBars,
  baseline,
  bollinger,
  bollinger,
  renko,
];

export function generateAvatarSvg(seed: string): string {
  const rng = mulberry32(hashSeed(seed));
  const [b0, b1] = pick(rng, BACKGROUNDS);
  const [up, down] = pick(rng, SCHEMES);
  const accent = pick(rng, ACCENTS);
  const bullish = rng() < 0.7;
  const tag = rng() < 0.6;
  const angle = rng() * Math.PI * 2;
  const gx = 64 + Math.cos(angle) * 64;
  const gy = 64 + Math.sin(angle) * 64;

  const ctx: Ctx = {
    x0: 20,
    x1: 108,
    y0: tag ? 48 : 30,
    y1: 102,
    up,
    down,
    accent,
    bullish,
  };

  let out = `<defs>`;
  out += `<linearGradient id="bg" x1="${f(gx / 128)}" y1="${f(gy / 128)}" x2="${f(1 - gx / 128)}" y2="${f(1 - gy / 128)}"><stop offset="0" stop-color="${b0}"/><stop offset="1" stop-color="${b1}"/></linearGradient>`;
  out += `<radialGradient id="gw" cx="${f(rng())}" cy="${f(rng() * 0.6)}" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`;
  out += `<filter id="gl" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
  out += `</defs><rect width="128" height="128" fill="url(#bg)"/><rect width="128" height="128" fill="url(#gw)"/>`;

  // chart grid
  const vertical = rng() < 0.5;
  out += `<g stroke="#fff" stroke-opacity=".1" stroke-width="1">`;
  for (let i = 1; i < 5; i++) out += `<line x1="0" y1="${i * 25.6}" x2="128" y2="${i * 25.6}"/>`;
  if (vertical) for (let i = 1; i < 5; i++) out += `<line x1="${i * 25.6}" y1="0" x2="${i * 25.6}" y2="128"/>`;
  out += `</g>`;

  out += pick(rng, BODIES)(rng, ctx);

  if (tag) {
    const sym = pick(rng, TICKERS);
    const col = bullish ? up : down;
    const tri = bullish ? "M34 33l5-8 5 8z" : "M34 25l5 8 5-8z";
    out += `<rect x="26" y="19" width="76" height="20" rx="10" fill="#050914" opacity=".55"/>`;
    out += `<path d="${tri}" fill="${col}" transform="translate(-2 0)"/>`;
    out += `<text x="70" y="33.5" text-anchor="middle" ${FONT} font-size="11" letter-spacing=".4" fill="#fff">${sym}</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">${out}</svg>`;
}

// A leader's avatar: roughly half get a ZuluTrade-style initials badge (always
// for handle-like Latin names containing "FX"), the rest a trading-chart mark.
// Chosen deterministically from the id so it never changes between requests.
export function generateLeaderAvatarSvg(seed: string, name: string | null | undefined): string {
  const clean = (name ?? "").trim();
  if (!clean) return generateAvatarSvg(seed);
  const useInitials = /fx/i.test(clean) || hashSeed(seed + "|style") % 100 < 55;
  return useInitials ? generateInitialsSvg(seed, clean) : generateAvatarSvg(seed);
}
