import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { countryDisplay } from "@/lib/country-metadata";
import { traderAvatarUrl } from "@/lib/trader-avatar";
import { TraderPostMiniChart } from "@/components/TraderPostMiniChart";
import { relativeTimeAr } from "@/lib/relative-time-ar";

export async function TraderPostsFeed() {
  const supabase = await createClient();

  const { data: posts } = await supabase
    .from("trader_posts")
    .select("id, provider_id, body, symbol, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  if (!posts || posts.length === 0) return null;

  // providers itself is select-restricted to authenticated users, so a
  // logged-out visitor can only read display_name/country through the
  // provider_cards view (it bypasses RLS as the view owner) — same pattern
  // src/app/page.tsx already uses for its own top-traders section.
  const providerIds = Array.from(new Set(posts.map((p) => p.provider_id)));
  const { data: providers } = await supabase
    .from("provider_cards")
    .select("provider_id, display_name, country")
    .in("provider_id", providerIds);

  const providerById = new Map((providers ?? []).map((p) => [p.provider_id, p]));

  return (
    <div className="mx-auto flex w-full max-w-5xl gap-3 overflow-x-auto pb-2">
      {posts.map((post) => {
        const provider = providerById.get(post.provider_id);
        if (!provider) return null;
        const country = countryDisplay(provider.country);
        return (
          <Link
            key={post.id}
            href={`/trader/${post.provider_id}`}
            className="flex w-72 shrink-0 flex-col gap-2 rounded-xl border border-border bg-surface p-4 transition hover:border-accent/40 hover:shadow-lg"
          >
            <div className="flex items-center gap-2.5">
              <img
                src={traderAvatarUrl(post.provider_id)}
                alt=""
                className="h-9 w-9 shrink-0 rounded-full bg-background"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="min-w-0 truncate text-sm font-semibold">{provider.display_name}</p>
                  {country && <span className="text-xs">{country.flag}</span>}
                </div>
                <p className="text-[11px] text-muted">{relativeTimeAr(post.created_at)}</p>
              </div>
            </div>
            {post.symbol && <TraderPostMiniChart symbol={post.symbol} />}
            <p className="text-sm leading-relaxed text-muted">{post.body}</p>
          </Link>
        );
      })}
    </div>
  );
}
