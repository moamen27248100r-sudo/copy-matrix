// Deterministic avatar generator: the same seed always produces the same
// picture, with no image files, no third-party service, and nobody real in
// it. Every avatar is a financial-markets mark -- candlestick and line charts,
// currency-pair badges, currency coins, gold bars, crypto coins, bull / bear,
// order-book depth, allocation donut, heatmap, globe, risk gauge, ...
// Everything is drawn on a 128x128 square; the UI clips it to a circle.

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

const UP = "#0ecb81";
const DOWN = "#f6465d";
const GOLD = "#f0b90b";

// Mostly dark "terminal" backgrounds, plus a few brand colours.
const BACKGROUNDS: readonly (readonly [string, string])[] = [
  ["#1b2740", "#0b1120"],
  ["#12303a", "#08141a"],
  ["#2a2148", "#0f0b22"],
  ["#1f3b2e", "#0a1610"],
  ["#3a2a1a", "#150e08"],
  ["#2f6fed", "#1b3f9a"],
  ["#14b8c6", "#0b6f8a"],
  ["#7c5cff", "#4326b8"],
  ["#22c55e", "#0f6b35"],
  ["#3b4a6b", "#1a2236"],
];
const DARK = [0, 1, 2, 3, 9] as const;
const BRIGHT = [5, 6, 7, 8] as const;

const FONT = `font-family="Arial, Helvetica, sans-serif" font-weight="700"`;

function bg(palette: readonly [string, string]) {
  return `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette[0]}"/><stop offset="1" stop-color="${palette[1]}"/></linearGradient></defs><rect width="128" height="128" fill="url(#g)"/>`;
}
const pal = (rng: Rng, group: readonly number[]) => BACKGROUNDS[pick(rng, group)];
const grid = (n = 3) =>
  `<g stroke="#fff" stroke-opacity=".08">${Array.from({ length: n }, (_, i) => `<line x1="0" y1="${(128 / (n + 1)) * (i + 1)}" x2="128" y2="${(128 / (n + 1)) * (i + 1)}"/>`).join("")}</g>`;

// ---------- charts ----------

function candles(rng: Rng): string {
  let out = bg(pal(rng, DARK)) + grid();
  const n = 5 + Math.floor(rng() * 3);
  const step = 104 / n;
  const w = Math.min(12, step * 0.55);
  let y = 72 + rng() * 10;
  const closes: number[] = [];
  for (let i = 0; i < n; i++) {
    const up = rng() < 0.58;
    const h = 12 + rng() * 24;
    const top = up ? y - h : y;
    const color = up ? UP : DOWN;
    const x = 12 + i * step;
    out += `<line x1="${x + w / 2}" y1="${top - 8}" x2="${x + w / 2}" y2="${top + h + 8}" stroke="${color}" stroke-width="2"/><rect x="${x}" y="${top}" width="${w}" height="${h}" rx="2" fill="${color}"/>`;
    closes.push(up ? top : top + h);
    y = Math.min(100, Math.max(44, (up ? top : top + h) + (rng() - 0.55) * 12));
  }
  const d = closes.map((c, i) => `${i ? "L" : "M"}${12 + i * step + w / 2} ${c}`).join(" ");
  out += `<path d="${d}" fill="none" stroke="${GOLD}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>`;
  return out;
}

function trendLine(rng: Rng): string {
  let out = bg(pal(rng, [...DARK, ...BRIGHT])) + grid();
  const pts: [number, number][] = [];
  let y = 96;
  for (let i = 0; i < 8; i++) {
    y = Math.max(26, Math.min(104, y - 3 - rng() * 12 + (rng() < 0.3 ? 12 : 0)));
    pts.push([10 + i * 15.5, y]);
  }
  const d = pts.map(([x, py], i) => `${i ? "L" : "M"}${x} ${py}`).join(" ");
  out += `<path d="${d} L${pts[pts.length - 1][0]} 120 L10 120z" fill="#fff" opacity=".12"/>`;
  out += `<path d="${d}" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;
  const [lx, ly] = pts[pts.length - 1];
  out += `<circle cx="${lx}" cy="${ly}" r="8" fill="${UP}" stroke="#fff" stroke-width="3"/>`;
  return out;
}

function areaChart(rng: Rng): string {
  const color = rng() < 0.75 ? UP : DOWN;
  let out = bg(pal(rng, DARK)) + grid(4);
  const pts: [number, number][] = [];
  let y = color === UP ? 92 : 40;
  for (let i = 0; i < 9; i++) {
    y = Math.max(28, Math.min(104, y + (color === UP ? -1 : 1) * (2 + rng() * 6) + (rng() - 0.5) * 20));
    pts.push([8 + i * 14, y]);
  }
  const d = pts.map(([x, py], i) => `${i ? "L" : "M"}${x} ${py}`).join(" ");
  out += `<defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".55"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>`;
  out += `<path d="${d} L${pts[pts.length - 1][0]} 120 L8 120z" fill="url(#a)"/><path d="${d}" fill="none" stroke="${color}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>`;
  return out;
}

function maCross(rng: Rng): string {
  let out = bg(pal(rng, DARK)) + grid();
  const fast: string[] = [];
  const slow: string[] = [];
  for (let i = 0; i < 9; i++) {
    const x = 8 + i * 14;
    const base = 76 - i * 3 + Math.sin(i * 0.9 + rng()) * 6;
    slow.push(`${i ? "L" : "M"}${x} ${base + 6 - i * 0.6}`);
    fast.push(`${i ? "L" : "M"}${x} ${base + Math.cos(i * 1.2 + rng()) * 16 - i * 1.5}`);
  }
  out += `<path d="${slow.join(" ")}" fill="none" stroke="${GOLD}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  out += `<path d="${fast.join(" ")}" fill="none" stroke="#4f8cff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  return out;
}

function depth(rng: Rng): string {
  let out = bg(pal(rng, DARK)) + grid();
  const left: string[] = ["M6 116"];
  const right: string[] = ["M122 116"];
  let l = 30 + rng() * 20;
  let r = 30 + rng() * 20;
  for (let i = 0; i < 6; i++) {
    l += 8 + rng() * 10;
    r += 8 + rng() * 10;
    left.push(`L${58 - i * 9} ${116 - l * 0.85}`);
    right.push(`L${70 + i * 9} ${116 - r * 0.85}`);
  }
  out += `<path d="${left.join(" ")} L6 20 L6 116z" fill="${UP}" opacity=".55"/><path d="${left.join(" ")}" fill="none" stroke="${UP}" stroke-width="2.5"/>`;
  out += `<path d="${right.join(" ")} L122 20 L122 116z" fill="${DOWN}" opacity=".55"/><path d="${right.join(" ")}" fill="none" stroke="${DOWN}" stroke-width="2.5"/>`;
  out += `<line x1="64" y1="14" x2="64" y2="116" stroke="#fff" stroke-opacity=".35" stroke-dasharray="3 4"/>`;
  return out;
}

function bars(rng: Rng): string {
  let out = bg(pal(rng, [...DARK, ...BRIGHT]));
  const heights = Array.from({ length: 5 }, (_, i) => 20 + i * 11 + rng() * 14);
  heights.forEach((h, i) => {
    out += `<rect x="${18 + i * 20}" y="${108 - h}" width="14" height="${h}" rx="4" fill="#fff" opacity="${0.5 + i * 0.1}"/>`;
  });
  out += `<path d="M20 64l24-14 22 8 40-28" fill="none" stroke="${UP}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M96 26h14v14" fill="none" stroke="${UP}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;
  return out;
}

function heatmap(rng: Rng): string {
  let out = bg(pal(rng, DARK));
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    const up = rng() < 0.6;
    out += `<rect x="${16 + c * 25}" y="${16 + r * 25}" width="21" height="21" rx="4" fill="${up ? UP : DOWN}" opacity="${0.35 + rng() * 0.6}"/>`;
  }
  return out;
}

function donut(rng: Rng): string {
  let out = bg(pal(rng, DARK));
  const cols = [UP, "#4f8cff", GOLD, "#a78bfa", DOWN];
  const parts = Array.from({ length: 4 }, () => 0.15 + rng());
  const sum = parts.reduce((a, b) => a + b, 0);
  const C = 2 * Math.PI * 32;
  let offset = 0;
  parts.forEach((p, i) => {
    const len = (p / sum) * C;
    out += `<circle cx="64" cy="64" r="32" fill="none" stroke="${cols[i]}" stroke-width="16" stroke-dasharray="${len - 2} ${C - len + 2}" stroke-dashoffset="${-offset}" transform="rotate(-90 64 64)"/>`;
    offset += len;
  });
  out += `<circle cx="64" cy="64" r="16" fill="#0b1120" opacity=".85"/>`;
  return out;
}

function gauge(rng: Rng): string {
  let out = bg(pal(rng, DARK));
  out += `<path d="M20 88a44 44 0 0 1 88 0" fill="none" stroke="${DOWN}" stroke-width="10" stroke-linecap="round" stroke-dasharray="30 400"/>`;
  out += `<path d="M20 88a44 44 0 0 1 88 0" fill="none" stroke="${GOLD}" stroke-width="10" stroke-linecap="round" stroke-dasharray="0 30 30 400"/>`;
  out += `<path d="M20 88a44 44 0 0 1 88 0" fill="none" stroke="${UP}" stroke-width="10" stroke-linecap="round" stroke-dasharray="0 60 80 400"/>`;
  const a = (-160 + rng() * 140) * (Math.PI / 180);
  out += `<line x1="64" y1="88" x2="${64 + 34 * Math.cos(a)}" y2="${88 + 34 * Math.sin(a)}" stroke="#fff" stroke-width="4" stroke-linecap="round"/><circle cx="64" cy="88" r="7" fill="#fff"/>`;
  return out;
}

// ---------- currency / commodities / crypto ----------

function fxCoin(rng: Rng): string {
  const symbol = pick(rng, ["$", "€", "£", "¥"] as const);
  let out = bg(pal(rng, [...BRIGHT, 0, 2]));
  out += `<circle cx="64" cy="64" r="44" fill="#fff" opacity=".14"/><circle cx="64" cy="64" r="36" fill="#fff"/>`;
  out += `<circle cx="64" cy="64" r="28" fill="none" stroke="#000" stroke-opacity=".1" stroke-width="2"/>`;
  out += `<text x="64" y="78" text-anchor="middle" ${FONT} font-size="42" fill="${pick(rng, ["#1b3f9a", "#0f6b35", "#a3223a", "#4326b8"])}">${symbol}</text>`;
  out += `<path d="M22 108l18-10 12 8 16-14 22 6" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
  return out;
}

function pairBadge(rng: Rng): string {
  const pair = pick(rng, ["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD", "USD/CHF", "NZD/USD", "EUR/GBP", "EUR/JPY", "GBP/JPY"] as const);
  const [a, b] = pair.split("/");
  let out = bg(pal(rng, DARK));
  out += `<circle cx="48" cy="46" r="24" fill="#2f6fed"/><circle cx="80" cy="46" r="24" fill="${pick(rng, ["#0ecb81", "#f0a020", "#7c5cff", "#f6465d"])}" style="mix-blend-mode:screen" opacity=".9"/>`;
  out += `<text x="42" y="52" text-anchor="middle" ${FONT} font-size="15" fill="#fff">${a[0]}</text><text x="86" y="52" text-anchor="middle" ${FONT} font-size="15" fill="#fff">${b[0]}</text>`;
  out += `<rect x="12" y="82" width="104" height="30" rx="15" fill="#fff" opacity=".95"/>`;
  out += `<text x="64" y="103" text-anchor="middle" ${FONT} font-size="18" fill="#0b1120">${pair}</text>`;
  return out;
}

function goldBars(rng: Rng): string {
  let out = bg(pal(rng, [0, 4, 9]));
  out += `<circle cx="64" cy="64" r="50" fill="${GOLD}" opacity=".1"/>`;
  const bar = (x: number, y: number, s = 1) =>
    `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 26l8-20h48l8 20z" fill="#ffd84d"/><path d="M0 26h64v8H0z" fill="#d99a06"/><path d="M8 6h48l-3 8H11z" fill="#fff" opacity=".35"/></g>`;
  out += bar(18, 52) + bar(46, 52) + bar(32, 28);
  out += `<text x="64" y="104" text-anchor="middle" ${FONT} font-size="16" letter-spacing="2" fill="${GOLD}">XAU</text>`;
  return out;
}

function goldCoin(rng: Rng): string {
  let out = bg(pal(rng, [0, 4, 9]));
  out += `<circle cx="64" cy="64" r="42" fill="${GOLD}"/><circle cx="64" cy="64" r="34" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="3"/>`;
  out += `<text x="64" y="76" text-anchor="middle" ${FONT} font-size="32" fill="#8a5a00">Au</text>`;
  out += `<path d="M30 30l6 6M92 28l-6 6" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`;
  return out;
}

function btcCoin(rng: Rng): string {
  let out = bg(pal(rng, [0, 2, 4]));
  out += `<circle cx="64" cy="64" r="42" fill="#f7931a"/><circle cx="64" cy="64" r="34" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="2.5"/>`;
  out += `<path d="M52 42h16c8 0 12 4 12 10s-4 9-9 10c7 1 11 5 11 11s-5 11-14 11H52z M60 50v10h7c4 0 6-2 6-5s-2-5-6-5z M60 68v11h8c4 0 7-2 7-5.5S72 68 68 68z" fill="#fff" fill-rule="evenodd"/>`;
  out += `<path d="M58 36v8M66 36v8M58 84v8M66 84v8" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`;
  return out;
}

function ethCoin(rng: Rng): string {
  let out = bg(pal(rng, [1, 2, 9]));
  out += `<circle cx="64" cy="64" r="42" fill="#627eea"/>`;
  out += `<path d="M64 26l-22 36 22 13 22-13z" fill="#fff" opacity=".9"/><path d="M64 26v49l22-13z" fill="#fff" opacity=".6"/><path d="M42 68l22 32 22-32-22 13z" fill="#fff" opacity=".85"/>`;
  return out;
}

function altCoin(rng: Rng): string {
  const c = pick(rng, ["#14b8c6", "#7c5cff", "#0ecb81", "#e05fa5"] as const);
  let out = bg(pal(rng, DARK));
  out += `<circle cx="64" cy="64" r="42" fill="${c}"/><circle cx="64" cy="64" r="34" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="2.5"/>`;
  out += `<path d="M44 78l14-18 10 10 16-24" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`;
  out += `<path d="M28 40h10M90 92h10M30 96h8" stroke="#fff" stroke-opacity=".5" stroke-width="3" stroke-linecap="round"/>`;
  return out;
}

// ---------- market symbols ----------

function bull(rng: Rng): string {
  let out = bg(pal(rng, [3, 8, 1]));
  out += `<path d="M20 30c4 22 14 26 24 26M108 30c-4 22-14 26-24 26" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/>`;
  out += `<path d="M38 52c8-8 44-8 52 0l-4 30c-2 12-10 22-22 22s-20-10-22-22z" fill="${UP}"/>`;
  out += `<path d="M46 82c0 8 8 14 18 14s18-6 18-14c0-6-8-8-18-8s-18 2-18 8z" fill="#fff" opacity=".9"/>`;
  out += `<circle cx="56" cy="86" r="2.6" fill="#0b1120"/><circle cx="72" cy="86" r="2.6" fill="#0b1120"/>`;
  out += `<circle cx="52" cy="64" r="3.4" fill="#0b1120"/><circle cx="76" cy="64" r="3.4" fill="#0b1120"/>`;
  out += `<path d="M96 100l10-10 8 6 8-14M116 82h6v6" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" transform="translate(-14 -2)"/>`;
  return out;
}

function bear(rng: Rng): string {
  let out = bg(pal(rng, [0, 2, 4]));
  out += `<circle cx="38" cy="38" r="15" fill="${DOWN}"/><circle cx="90" cy="38" r="15" fill="${DOWN}"/><circle cx="38" cy="38" r="7" fill="#fff" opacity=".35"/><circle cx="90" cy="38" r="7" fill="#fff" opacity=".35"/>`;
  out += `<ellipse cx="64" cy="66" rx="36" ry="34" fill="${DOWN}"/><ellipse cx="64" cy="78" rx="17" ry="13" fill="#fff" opacity=".9"/>`;
  out += `<ellipse cx="64" cy="73" rx="6" ry="4" fill="#0b1120"/><circle cx="50" cy="58" r="3.4" fill="#0b1120"/><circle cx="78" cy="58" r="3.4" fill="#0b1120"/>`;
  out += `<path d="M24 100l12 8 10-10 12 8" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M58 106h8v-8" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  return out;
}

function trendArrow(rng: Rng): string {
  const up = rng() < 0.72;
  const c = up ? UP : DOWN;
  let out = bg(pal(rng, DARK));
  out += `<circle cx="64" cy="64" r="42" fill="${c}" opacity=".18"/>`;
  out += up
    ? `<path d="M30 92l24-26 16 14 30-38" fill="none" stroke="${c}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><path d="M84 40h20v20" fill="none" stroke="${c}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`
    : `<path d="M30 38l24 26 16-14 30 38" fill="none" stroke="${c}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><path d="M84 88h20V68" fill="none" stroke="${c}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`;
  return out;
}

function globe(rng: Rng): string {
  let out = bg(pal(rng, [...DARK, 5, 6]));
  out += `<circle cx="64" cy="64" r="42" fill="#fff" opacity=".08"/><g fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="3"><circle cx="64" cy="64" r="42"/><ellipse cx="64" cy="64" rx="18" ry="42"/><path d="M22 64h84M28 42h72M28 86h72"/></g>`;
  const dx = 40 + rng() * 48;
  const dy = 40 + rng() * 48;
  out += `<circle cx="${dx}" cy="${dy}" r="7" fill="${UP}" stroke="#fff" stroke-width="2.5"/>`;
  return out;
}

function shield(rng: Rng): string {
  let out = bg(pal(rng, [0, 9, 1]));
  out += `<path d="M64 18l36 12v30c0 24-15 40-36 50-21-10-36-26-36-50V30z" fill="#fff" opacity=".95"/><path d="M64 18l36 12v30c0 24-15 40-36 50z" fill="#000" opacity=".06"/>`;
  out += `<path d="M44 76l12-12 8 8 20-24" fill="none" stroke="${UP}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`;
  return out;
}

function rocket(rng: Rng): string {
  let out = bg(pal(rng, [2, 7, 0]));
  out += `<g stroke="#fff" stroke-opacity=".25" stroke-width="2"><line x1="20" y1="30" x2="20" y2="44"/><line x1="100" y1="20" x2="100" y2="32"/><line x1="30" y1="96" x2="30" y2="108"/></g>`;
  out += `<g transform="rotate(40 64 64)"><path d="M64 14c14 14 16 40 12 62H52c-4-22-2-48 12-62z" fill="#fff"/><circle cx="64" cy="42" r="7" fill="#2f6fed"/><path d="M52 76l-12 14 14-4zM76 76l12 14-14-4z" fill="${DOWN}"/><path d="M58 76h12l-6 20z" fill="${GOLD}"/></g>`;
  return out;
}

function chartFrame(rng: Rng): string {
  // Screen-like candlestick panel with a price tag.
  let out = bg(pal(rng, DARK));
  out += `<rect x="12" y="16" width="104" height="96" rx="10" fill="#0b1120" opacity=".7" stroke="#fff" stroke-opacity=".15"/>`;
  let y = 76;
  for (let i = 0; i < 6; i++) {
    const up = rng() < 0.6;
    const h = 8 + rng() * 18;
    const top = up ? y - h : y;
    const color = up ? UP : DOWN;
    const x = 20 + i * 14;
    out += `<line x1="${x + 4}" y1="${top - 6}" x2="${x + 4}" y2="${top + h + 6}" stroke="${color}" stroke-width="1.6"/><rect x="${x}" y="${top}" width="8" height="${h}" rx="1.5" fill="${color}"/>`;
    y = Math.min(88, Math.max(44, (up ? top : top + h) + (rng() - 0.55) * 10));
  }
  out += `<rect x="72" y="22" width="38" height="14" rx="7" fill="${UP}"/><text x="91" y="32.5" text-anchor="middle" ${FONT} font-size="9.5" fill="#0b1120">+${(1 + rng() * 9).toFixed(1)}%</text>`;
  return out;
}

const MARKS = [
  candles, candles, trendLine, areaChart, areaChart, maCross, depth, bars, heatmap, donut, gauge, chartFrame,
  fxCoin, fxCoin, pairBadge, pairBadge, pairBadge, goldBars, goldCoin, btcCoin, ethCoin, altCoin,
  bull, bear, trendArrow, globe, shield, rocket,
] as const;

export function generateAvatarSvg(seed: string): string {
  const rng = mulberry32(hashSeed(seed));
  const body = pick(rng, MARKS)(rng);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">${body}</svg>`;
}
