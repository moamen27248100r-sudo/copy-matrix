import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// One shared read of market_prices for every user. The CDN caches the response
// for a second (s-maxage) so concurrent clients share a single origin hit, and
// the in-process cache below coalesces whatever still reaches this instance.
// Market prices are public data; nothing user-specific is returned and no
// third-party API key is involved (the DB cron fetches Binance/frankfurter).
export const dynamic = "force-dynamic";

const TTL_MS = 1000;

type Payload = { prices: Record<string, number>; forexAsOf: Record<string, string> };

let cache: { at: number; payload: Payload } | null = null;
let inflight: Promise<Payload> | null = null;

async function load(): Promise<Payload> {
  const { data, error } = await createAdminClient().from("market_prices").select("symbol, price, source_date");
  if (error || !data) throw error ?? new Error("no data");
  const prices: Record<string, number> = {};
  const forexAsOf: Record<string, string> = {};
  for (const row of data) {
    prices[row.symbol] = Number(row.price);
    if (row.source_date) forexAsOf[row.symbol] = row.source_date;
  }
  return { prices, forexAsOf };
}

export async function GET() {
  const now = Date.now();
  if (!cache || now - cache.at > TTL_MS) {
    try {
      inflight ??= load().finally(() => {
        inflight = null;
      });
      cache = { at: now, payload: await inflight };
    } catch {
      if (!cache) return NextResponse.json({ error: "unavailable" }, { status: 503 });
    }
  }
  return NextResponse.json(cache.payload, {
    headers: { "Cache-Control": "public, s-maxage=1, stale-while-revalidate=2" },
  });
}
