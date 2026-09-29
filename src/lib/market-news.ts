// Real market news from Investing.com's own official RSS feed — RSS is
// explicitly a syndication mechanism (the publisher offers it so other
// sites can display its headlines + link back), unlike scraping a specific
// person's post. Shown as news with its real source/author named and a
// real link out — never attributed to one of our fictional trader personas.
export type MarketNewsItem = {
  title: string;
  source: string;
  link: string;
  pubDate: string;
  imageUrl: string | null;
};

function extractTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  if (!match) return null;
  return match[1]
    .replace("<![CDATA[", "")
    .replace("]]>", "")
    .trim();
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
      if (!title || !link) return null;
      return {
        title,
        source: author ?? "Investing.com",
        link,
        pubDate: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        imageUrl: enclosureMatch?.[1] ?? null,
      };
    })
    .filter((i): i is MarketNewsItem => i !== null);
}

export async function getMarketNews(limit = 12): Promise<MarketNewsItem[]> {
  try {
    const res = await fetch("https://www.investing.com/rss/news.rss", {
      next: { revalidate: 900 }, // real news, refreshed every 15 minutes — never stale
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CopyMatrixBot/1.0)" },
    });
    if (!res.ok) return [];

    const xml = await res.text();
    return parseRssItems(xml).slice(0, limit);
  } catch {
    return []; // best-effort external feed — the section just hides itself if it's down
  }
}
