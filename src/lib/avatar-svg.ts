// Deterministic avatar generator: the same seed always produces the same
// picture, with no image files, no third-party service, and nobody real in
// it. Three categories make up the "library":
//   - illustrated portraits (skin tone x hair style x clothing x accessories)
//   - trading / FX marks (candlesticks, trend line, currency coin, shield, bars)
//   - abstract team marks (rings, overlapping circles, hexagon, pinwheel, dots)
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

const BACKGROUNDS: readonly (readonly [string, string])[] = [
  ["#2f6fed", "#1b3f9a"],
  ["#0ecb81", "#08805a"],
  ["#f0a020", "#b86a0a"],
  ["#7c5cff", "#4326b8"],
  ["#14b8c6", "#0b6f8a"],
  ["#f6465d", "#a3223a"],
  ["#3b4a6b", "#1a2236"],
  ["#e05fa5", "#8e2a68"],
  ["#4f8cff", "#243c8c"],
  ["#22c55e", "#0f6b35"],
];

const SKIN = ["#f6d3b8", "#eab894", "#d69a6b", "#b97a4c", "#8d5a37", "#6a4227"] as const;
const HAIR = ["#17171b", "#2e2119", "#4a2f1c", "#7a4e26", "#b48a4a", "#8b8b93"] as const;
const CLOTHES = ["#1f2a44", "#2b3a5c", "#3a3f4b", "#0f4c5c", "#5b2a4a", "#233a2f", "#4a3a26", "#f4f6fa"] as const;
const ACCENTS = ["#f6465d", "#0ecb81", "#f0a020", "#2f6fed", "#7c5cff"] as const;

function bg(id: string, [a, b]: readonly [string, string]) {
  return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="128" height="128" fill="url(#${id})"/>`;
}

// ---------- portraits ----------

function portrait(rng: Rng): string {
  const palette = pick(rng, BACKGROUNDS);
  const skin = pick(rng, SKIN);
  const hair = pick(rng, HAIR);
  const clothes = pick(rng, CLOTHES);
  const light = clothes === "#f4f6fa";
  const style = pick(rng, ["short", "short", "long", "bun", "curly", "bald", "hijab", "cap"] as const);
  const beard = (style === "short" || style === "bald" || style === "curly") && rng() < 0.4;
  const glasses = rng() < 0.25;
  const suit = rng() < 0.55;
  const tie = pick(rng, ACCENTS);

  let out = bg("g", palette);
  out += `<circle cx="100" cy="24" r="34" fill="#fff" opacity=".07"/>`;

  // hair behind head
  if (style === "long") out += `<path d="M36 60c-2-26 12-40 28-40s30 14 28 40c0 20 6 34 6 46H30c0-12 6-26 6-46z" fill="${hair}"/>`;
  if (style === "hijab") out += `<path d="M30 112c-4-20-2-50 8-64 6-8 16-14 26-14s20 6 26 14c10 14 12 44 8 64z" fill="${pick(rng, ["#f4f6fa", "#2b3a5c", "#5b2a4a", "#0f4c5c", "#c9a86a"])}"/>`;

  // body
  out += `<path d="M12 128c0-22 22-34 52-34s52 12 52 34z" fill="${clothes}"/>`;
  if (suit) {
    out += `<path d="M64 94l-16 4 16 30 16-30z" fill="#f4f6fa"/><path d="M64 98l-4 6 4 22 4-22z" fill="${tie}"/>`;
    out += `<path d="M12 128c0-22 22-34 52-34l-16 4 16 30z M116 128c0-22-22-34-52-34l16 4-16 30z" fill="#0c1220" opacity=".35"/>`;
  } else {
    out += `<path d="M48 96c4 8 12 12 16 12s12-4 16-12" fill="none" stroke="${light ? "#c8cedb" : "#0c1220"}" stroke-opacity=".4" stroke-width="3"/>`;
  }

  // neck + head
  out += `<rect x="55" y="76" width="18" height="22" rx="6" fill="${skin}"/><rect x="55" y="84" width="18" height="10" rx="4" fill="#000" opacity=".12"/>`;
  out += `<ellipse cx="42.5" cy="60" rx="4" ry="6" fill="${skin}"/><ellipse cx="85.5" cy="60" rx="4" ry="6" fill="${skin}"/>`;
  out += `<ellipse cx="64" cy="58" rx="22" ry="27" fill="${skin}"/>`;

  // beard
  if (beard) out += `<path d="M42 62c0 20 10 28 22 28s22-8 22-28c-4 10-12 14-22 14s-18-4-22-14z" fill="${hair}" opacity=".92"/>`;

  // hair on top
  if (style === "short") out += `<path d="M41 54c-2-20 8-32 23-32s25 12 23 32c-2-8-8-14-14-16-8 4-20 4-28 2-2 4-3 9-4 14z" fill="${hair}"/>`;
  if (style === "long") out += `<path d="M41 56c-3-20 7-34 23-34s26 14 23 34c-3-10-9-16-14-18-9 4-20 4-28 2-2 4-3 10-4 16z" fill="${hair}"/>`;
  if (style === "bun") out += `<circle cx="64" cy="20" r="10" fill="${hair}"/><path d="M41 54c-2-20 8-30 23-30s25 10 23 30c-2-8-8-14-14-16-8 4-20 4-28 2-2 4-3 9-4 14z" fill="${hair}"/>`;
  if (style === "curly") {
    for (const [cx, cy, r] of [[44, 42, 9], [54, 34, 10], [66, 32, 10], [78, 36, 10], [86, 46, 9], [40, 54, 7]] as const) out += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${hair}"/>`;
  }
  if (style === "hijab") out += `<path d="M41 60c0-16 10-24 23-24s23 8 23 24c0 12-6 22-23 22S41 72 41 60z" fill="${skin}"/>`;
  if (style === "cap") {
    const cap = pick(rng, ACCENTS);
    out += `<path d="M40 50c0-16 10-26 24-26s24 10 24 26z" fill="${cap}"/><path d="M40 50h60c4 0 6 3 4 5-2 2-6 2-10 2H40z" fill="${cap}" opacity=".85"/>`;
  }

  // face
  out += `<ellipse cx="54" cy="58" rx="2.6" ry="3.2" fill="#161a26"/><ellipse cx="74" cy="58" rx="2.6" ry="3.2" fill="#161a26"/>`;
  out += `<path d="M46 51q7-4 12-1M70 50q5-3 12 1" fill="none" stroke="${style === "hijab" || style === "cap" ? "#3a2a1e" : hair}" stroke-width="2.2" stroke-linecap="round"/>`;
  out += `<path d="M56 71q8 6 16 0" fill="none" stroke="${beard ? "#f4d8c8" : "#7a3b34"}" stroke-width="2.4" stroke-linecap="round"/>`;
  if (glasses) out += `<circle cx="54" cy="58" r="8" fill="none" stroke="#161a26" stroke-width="1.8"/><circle cx="74" cy="58" r="8" fill="none" stroke="#161a26" stroke-width="1.8"/><path d="M62 58h4" stroke="#161a26" stroke-width="1.8"/>`;
  return out;
}

// ---------- trading / FX marks ----------

function candles(rng: Rng): string {
  let out = bg("g", pick(rng, [BACKGROUNDS[6], BACKGROUNDS[0], BACKGROUNDS[3]]));
  out += `<g stroke="#fff" stroke-opacity=".08">${[32, 64, 96].map((y) => `<line x1="0" y1="${y}" x2="128" y2="${y}"/>`).join("")}</g>`;
  let y = 70 + rng() * 10;
  for (let i = 0; i < 5; i++) {
    const up = rng() < 0.55;
    const h = 14 + rng() * 22;
    const top = up ? y - h : y;
    const color = up ? "#0ecb81" : "#f6465d";
    const x = 16 + i * 21;
    out += `<line x1="${x + 6}" y1="${top - 8}" x2="${x + 6}" y2="${top + h + 8}" stroke="${color}" stroke-width="2"/><rect x="${x}" y="${top}" width="12" height="${h}" rx="2" fill="${color}"/>`;
    y = up ? top : top + h;
    y = Math.min(96, Math.max(46, y + (rng() - 0.55) * 12));
  }
  return out;
}

function trendLine(rng: Rng): string {
  const palette = pick(rng, [BACKGROUNDS[6], BACKGROUNDS[1], BACKGROUNDS[4]]);
  let out = bg("g", palette);
  const pts: [number, number][] = [];
  let y = 92;
  for (let i = 0; i < 7; i++) {
    y = Math.max(28, Math.min(100, y - 4 - rng() * 12 + (rng() < 0.3 ? 12 : 0)));
    pts.push([12 + i * 17, y]);
  }
  const d = pts.map(([x, py], i) => `${i ? "L" : "M"}${x} ${py}`).join(" ");
  out += `<path d="${d} L${pts[pts.length - 1][0]} 118 L12 118z" fill="#fff" opacity=".12"/>`;
  out += `<path d="${d}" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;
  const [lx, ly] = pts[pts.length - 1];
  out += `<circle cx="${lx}" cy="${ly}" r="8" fill="#0ecb81" stroke="#fff" stroke-width="3"/>`;
  return out;
}

function fxCoin(rng: Rng): string {
  const symbol = pick(rng, ["$", "€", "£", "¥"] as const);
  let out = bg("g", pick(rng, [BACKGROUNDS[2], BACKGROUNDS[0], BACKGROUNDS[7], BACKGROUNDS[3]]));
  out += `<circle cx="64" cy="64" r="40" fill="#fff" opacity=".16"/><circle cx="64" cy="64" r="32" fill="#fff"/>`;
  out += `<circle cx="64" cy="64" r="32" fill="none" stroke="#000" stroke-opacity=".08" stroke-width="3"/>`;
  out += `<text x="64" y="76" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="700" fill="${pick(rng, ["#1b3f9a", "#0f6b35", "#a3223a", "#4326b8"])}">${symbol}</text>`;
  out += `<path d="M30 100l16-10 10 8 14-14 20 6" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
  return out;
}

function shield(rng: Rng): string {
  let out = bg("g", pick(rng, [BACKGROUNDS[6], BACKGROUNDS[8], BACKGROUNDS[4]]));
  out += `<path d="M64 20l34 12v28c0 22-14 38-34 48-20-10-34-26-34-48V32z" fill="#fff" opacity=".95"/>`;
  out += `<path d="M64 20l34 12v28c0 22-14 38-34 48z" fill="#000" opacity=".06"/>`;
  out += `<path d="M44 74l12-12 8 8 18-22" fill="none" stroke="${pick(rng, ["#0ecb81", "#2f6fed"])}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`;
  return out;
}

function bars(rng: Rng): string {
  let out = bg("g", pick(rng, [BACKGROUNDS[9], BACKGROUNDS[0], BACKGROUNDS[5]]));
  const heights = [26, 40, 34, 58, 74];
  heights.forEach((h, i) => {
    out += `<rect x="${18 + i * 20}" y="${104 - h}" width="14" height="${h}" rx="4" fill="#fff" opacity="${0.55 + i * 0.09}"/>`;
  });
  out += `<path d="M20 60l24-14 22 8 40-26" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;
  return out;
}

// ---------- abstract team marks ----------

function rings(rng: Rng): string {
  let out = bg("g", pick(rng, BACKGROUNDS));
  const cx = 52 + rng() * 24;
  for (let i = 0; i < 4; i++) out += `<circle cx="${cx + i * 3}" cy="${64 - i * 2}" r="${44 - i * 10}" fill="none" stroke="#fff" stroke-opacity="${0.85 - i * 0.18}" stroke-width="${6 - i}"/>`;
  return out;
}

function triad(rng: Rng): string {
  let out = bg("g", pick(rng, [BACKGROUNDS[6], BACKGROUNDS[3], BACKGROUNDS[0]]));
  const cols = [pick(rng, ACCENTS), pick(rng, ACCENTS), pick(rng, ACCENTS)];
  out += `<g style="mix-blend-mode:screen"><circle cx="50" cy="52" r="30" fill="${cols[0]}" opacity=".85"/><circle cx="78" cy="52" r="30" fill="${cols[1]}" opacity=".85"/><circle cx="64" cy="78" r="30" fill="${cols[2]}" opacity=".85"/></g>`;
  return out;
}

function hexagon(rng: Rng): string {
  let out = bg("g", pick(rng, BACKGROUNDS));
  out += `<path d="M64 16l40 24v48l-40 24-40-24V40z" fill="#fff" opacity=".18"/><path d="M64 30l28 16v36l-28 16-28-16V46z" fill="#fff" opacity=".95"/>`;
  out += `<path d="M64 44l16 9v22l-16 9-16-9V53z" fill="${pick(rng, ACCENTS)}"/>`;
  return out;
}

function pinwheel(rng: Rng): string {
  let out = bg("g", pick(rng, BACKGROUNDS));
  const c = [pick(rng, ACCENTS), "#fff", pick(rng, ACCENTS), "#fff"];
  for (let i = 0; i < 4; i++) out += `<rect x="64" y="22" width="26" height="42" rx="13" fill="${c[i]}" opacity=".92" transform="rotate(${i * 90} 64 64)"/>`;
  out += `<circle cx="64" cy="64" r="9" fill="#0c1220" opacity=".55"/>`;
  return out;
}

function dots(rng: Rng): string {
  let out = bg("g", pick(rng, BACKGROUNDS));
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    const on = rng() < 0.62;
    out += `<circle cx="${28 + c * 24}" cy="${28 + r * 24}" r="${on ? 8 : 4}" fill="#fff" opacity="${on ? 0.95 : 0.35}"/>`;
  }
  return out;
}

const TRADING = [candles, trendLine, fxCoin, shield, bars] as const;
const TEAM = [rings, triad, hexagon, pinwheel, dots] as const;

export function avatarKind(seed: string): "portrait" | "trading" | "team" {
  const r = mulberry32(hashSeed(seed + "|kind"))();
  return r < 0.62 ? "portrait" : r < 0.84 ? "trading" : "team";
}

export function generateAvatarSvg(seed: string): string {
  const kind = avatarKind(seed);
  const rng = mulberry32(hashSeed(seed));
  const body = kind === "portrait" ? portrait(rng) : kind === "trading" ? pick(rng, TRADING)(rng) : pick(rng, TEAM)(rng);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">${body}</svg>`;
}
