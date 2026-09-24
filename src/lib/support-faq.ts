// FAQ content itself lives in the Faq namespace of each locale's messages
// file (src/messages/*.json), not here -- this module is pure, locale-
// agnostic matching logic that operates on whatever entry list it's given.
// See src/app/api/support-chat/route.ts for how it's loaded per-request.
export type FaqEntry = {
  id: string;
  question: string;
  keywords: string[];
  answer: string;
};

// A light normalization (diacritic/letter-variant folding + lowercase) that
// mainly benefits Arabic input but is a harmless no-op for other scripts,
// so it can stay universal instead of needing a per-locale version.
const NORMALIZE_MAP: Record<string, string> = {
  أ: "ا",
  إ: "ا",
  آ: "ا",
  ى: "ي",
  ة: "ه",
};

export function normalizeText(text: string): string {
  return text
    .split("")
    .map((ch) => NORMALIZE_MAP[ch] ?? ch)
    .join("")
    .toLowerCase()
    .trim();
}

const MATCH_THRESHOLD = 1;

function bestMatchIn(normalizedMessage: string, entries: FaqEntry[]): { entry: FaqEntry; score: number } | null {
  let best: { entry: FaqEntry; score: number } | null = null;
  for (const entry of entries) {
    let score = 0;
    for (const keyword of entry.keywords) {
      if (normalizedMessage.includes(normalizeText(keyword))) {
        score += 1;
      }
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { entry, score };
    }
  }
  return best;
}

export function matchFaq(message: string, entries: FaqEntry[], smallTalk: FaqEntry[]): FaqEntry | null {
  const normalizedMessage = normalizeText(message);

  const topical = bestMatchIn(normalizedMessage, entries);
  if (topical && topical.score >= MATCH_THRESHOLD) return topical.entry;

  const chat = bestMatchIn(normalizedMessage, smallTalk);
  if (chat && chat.score >= MATCH_THRESHOLD) return chat.entry;

  return null;
}

export function buildNoMatchFallback(
  entries: FaqEntry[],
  intro: string,
  outro: string,
  separator: string,
): string {
  const topicList = entries.slice(0, 8).map((f) => f.question).join(separator);
  return `${intro} ${topicList}. ${outro}`;
}
