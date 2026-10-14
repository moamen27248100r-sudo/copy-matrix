import { createClient } from "@/lib/supabase/server";
import { getLiveInstruments, getVolumes } from "@/lib/market-data";
import { MarketsBoard, type BoardRow } from "@/components/markets/MarketsBoard";

// The Markets view of Discover. Only instruments with a working price source are listed (a stale or
// missing price hides the instrument; nothing is ever shown without a real quote).
export async function MarketsTab({ userId }: { userId: string }) {
  const supabase = await createClient();
  const [live, volumes, { data: watch }] = await Promise.all([
    getLiveInstruments(),
    getVolumes(),
    supabase.from("market_watchlist").select("symbol").eq("user_id", userId),
  ]);

  const rows: BoardRow[] = live.map((r) => ({
    symbol: r.symbol,
    label: r.instrument.label,
    name: r.instrument.name,
    kind: r.instrument.kind,
    decimals: r.instrument.decimals,
    glyph: r.instrument.glyph,
    tone: r.instrument.tone,
    daily: !!r.instrument.daily,
    price: r.price,
    change: r.change_pct,
    high: r.high_24h,
    low: r.low_24h,
    spark: r.spark,
    volume: volumes[r.symbol]?.quoteVolume ?? null,
  }));

  return <MarketsBoard rows={rows} watched={(watch ?? []).map((w) => w.symbol as string)} />;
}
