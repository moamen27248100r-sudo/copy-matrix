// Real market news from Investing.com's own official RSS feeds -- RSS is explicitly a
// syndication mechanism (the publisher offers it so other sites can display its headlines and link
// back). Items are shown as headlines only, with the real source (the wire named in the feed, e.g.
// Reuters, via Investing.com), the publication time and a link out. Nothing here is generated.
export type MarketNewsItem = {
  title: string;
  source: string;
  link: string;
  pubDate: string;
  imageUrl: string | null;
};

export type NewsTopic = "forex" | "gold" | "crypto";

// Investing.com category feeds. Gold has no feed of its own: it comes from the commodities feed,
// narrowed to gold headlines.
const FEEDS: Record<NewsTopic, string> = {
  forex: "https://www.investing.com/rss/news_1.rss",
  gold: "https://www.investing.com/rss/news_11.rss",
  crypto: "https://www.investing.com/rss/news_301.rss",
};
const GOLD_WORDS = /\b(gold|xau|bullion|precious metals?)\b/i;

function extractTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  if (!match) return null;
  return match[1]
    .replace("<![CDATA[", "")
    .replace("]]>", "")
    .trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'");
}

function parseRssItems(xml: string): MarketNewsItem[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  return items
    .map((item) => {
      const title = extractTag(item, "title");
      const link = extractTag(item, "link");
      const pubDate = extractTag(item, "pubDate");
      const author = extractTag(item, "author");
      const enclosureMatch = item.match(/<enclosure url="([^"]+)"/);
      if (!title || !link || !pubDate) return null;
      // The feed gives UTC times without a zone ("2026-10-13 04:36:56").
      const when = new Date(/Z|[+-]\d{2}:?\d{2}$/.test(pubDate) ? pubDate : `${pubDate.replace(" ", "T")}Z`);
      if (Number.isNaN(when.getTime())) return null;
      if (!/^https:\/\/(www\.)?investing\.com\//.test(link)) return null;
      return {
        title: decodeEntities(title),
        source: author ? decodeEntities(author) : "Investing.com",
        link,
        pubDate: when.toISOString(),
        imageUrl: enclosureMatch?.[1] ?? null,
      };
    })
    .filter((i): i is MarketNewsItem => i !== null);
}

async function fetchFeed(url: string): Promise<MarketNewsItem[]> {
  try {
    const res = await fetch(url, {
      next: { revalidate: 900 }, // refreshed every 15 minutes, shared across requests
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CopyMatrixBot/1.0)" },
    });
    if (!res.ok) return [];
    return parseRssItems(await res.text());
  } catch {
    return []; // best-effort external feed: the section hides itself when it is down
  }
}

// Latest headlines for the given topics, newest first, without duplicates.
export async function getMarketNewsFor(topics: NewsTopic[], limit = 5): Promise<MarketNewsItem[]> {
  const unique = Array.from(new Set(topics));
  const lists = await Promise.all(
    unique.map(async (topic) => {
      const items = await fetchFeed(FEEDS[topic]);
      return topic === "gold" ? items.filter((i) => GOLD_WORDS.test(i.title)) : items;
    }),
  );
  const seen = new Set<string>();
  return lists
    .flat()
    .filter((i) => (seen.has(i.link) ? false : (seen.add(i.link), true)))
    .sort((a, b) => b.pubDate.localeCompare(a.pubDate))
    .slice(0, limit);
}

// Which topics matter for these instrument symbols; unknown or empty -> every topic.
export function topicsForSymbols(symbols: string[]): NewsTopic[] {
  const topics = new Set<NewsTopic>();
  for (const s of symbols) {
    if (s === "XAUUSD") topics.add("gold");
    else if (s.endsWith("USDT")) topics.add("crypto");
    else if (["EURUSD", "GBPUSD", "USDJPY"].includes(s)) topics.add("forex");
  }
  return topics.size > 0 ? Array.from(topics) : ["forex", "gold", "crypto"];
}
