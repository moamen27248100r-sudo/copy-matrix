import { getMarketNews } from "@/lib/market-news";
import { relativeTimeAr } from "@/lib/relative-time-ar";

// Real market news from real sources (see src/lib/market-news.ts) — shown
// as news, with its real source named and a real link out. Never attributed
// to one of our fictional trader personas.
export async function MarketNewsFeed() {
  const news = await getMarketNews();
  if (news.length === 0) return null;

  return (
    <div className="mx-auto flex w-full max-w-5xl gap-3 overflow-x-auto pb-2">
      {news.map((item) => (
        <a
          key={item.link}
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-72 shrink-0 flex-col gap-2 overflow-hidden rounded-xl border border-border bg-surface transition hover:border-accent/40 hover:shadow-lg"
        >
          {item.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.imageUrl} alt="" className="h-32 w-full object-cover" />
          )}
          <div className="flex flex-col gap-2 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs font-medium text-accent">{item.source}</span>
              <span className="shrink-0 text-[11px] text-muted">{relativeTimeAr(item.pubDate)}</span>
            </div>
            <p className="text-sm leading-relaxed text-foreground" dir="auto">
              {item.title}
            </p>
          </div>
        </a>
      ))}
    </div>
  );
}
