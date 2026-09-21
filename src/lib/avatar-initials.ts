// Initials badge avatars (ZuluTrade style): a round gradient badge carrying
// the leader's two initials -- "PT", "FX", "EA", or Arabic "أر". Drawn locally
// as SVG rather than through a third-party avatar service so that Arabic names
// render correctly, leader names never leave the platform, and the badge
// can't disappear if an external service does.

const ARABIC = /[؀-ۿ]/;

// Navy / gold / emerald gradients, each with a text colour that reads on it
// (navy carries the cyan initials from the reference ui-avatars badge).
const BADGES: readonly { from: string; to: string; text: string }[] = [
  { from: "#0d1b2a", to: "#1b2f4a", text: "#73fbfd" }, // navy
  { from: "#0d1b2a", to: "#1b2f4a", text: "#73fbfd" },
  { from: "#f2b431", to: "#a35f06", text: "#ffffff" }, // gold
  { from: "#12b886", to: "#065f46", text: "#ffffff" }, // emerald
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// "PipsKillerFX" -> FX, "Pips Trader" -> PT, "EliteAlpha" -> EA,
// "أنس ريان" -> [أ, ر] (first initial first), single word -> its first two letters.
export function initialsOf(name: string): string[] {
  const clean = name.replace(/[^\p{L}\p{N}\s]/gu, " ").trim();
  if (!clean) return ["?"];
  const words = clean.split(/\s+/);
  if (ARABIC.test(clean)) {
    // Skip the definite article ("النعيمي" -> ن, not ا).
    const core = words.map((w) => (w.length > 3 && w.startsWith("ال") ? w.slice(2) : w));
    const chars = core.length >= 2 ? [core[0][0], core[1][0]] : [...core[0]].slice(0, 2);
    return chars.length ? chars : ["?"];
  }
  if (words.length === 1) {
    if (/fx/i.test(words[0])) return ["F", "X"];
    const parts = words[0].match(/[A-Z][a-z]+|[A-Z]+(?![a-z])|[a-z]+|\d+/g) ?? [words[0]];
    const letters = parts.length >= 2 ? [parts[0][0], parts[1][0]] : [...words[0]].slice(0, 2);
    return letters.map((c) => c.toUpperCase());
  }
  return [words[0][0], words[1][0]].map((c) => c.toUpperCase());
}

export function generateInitialsSvg(seed: string, name: string): string {
  const badge = BADGES[hash(seed + "|badge") % BADGES.length];
  const [c0, c1] = [badge.from, badge.to];
  const initials = initialsOf(name);
  const arabic = ARABIC.test(name);
  const font = `font-family="Arial, Helvetica, sans-serif" font-weight="700" fill="${badge.text}" text-anchor="middle"`;
  const shadow = `filter="url(#ds)"`;

  let text: string;
  if (arabic && initials.length === 2) {
    // Separate glyphs so Arabic letters don't join into one ligature; the
    // first initial sits on the right, reading right-to-left.
    text =
      `<text x="83" y="83" font-size="56" ${font} ${shadow}>${initials[0]}</text>` +
      `<text x="45" y="83" font-size="56" ${font} ${shadow}>${initials[1]}</text>`;
  } else {
    const s = initials.join("");
    text = `<text x="64" y="82" font-size="${s.length > 1 ? 54 : 64}" letter-spacing="1" ${font} ${shadow}>${s}</text>`;
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">` +
    `<defs>` +
    `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c0}"/><stop offset="1" stop-color="${c1}"/></linearGradient>` +
    `<radialGradient id="hl" cx=".3" cy=".22" r=".75"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>` +
    `<filter id="ds" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity=".3"/></filter>` +
    `</defs>` +
    `<rect width="128" height="128" fill="url(#bg)"/><rect width="128" height="128" fill="url(#hl)"/>` +
    `<circle cx="64" cy="64" r="58" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="2"/>` +
    text +
    `</svg>`
  );
}
