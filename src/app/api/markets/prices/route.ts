import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLiveInstruments } from "@/lib/market-data";

// One request returns every live instrument at once (price, 24h change): the Markets page polls it
// every few seconds while it is visible, instead of one request per instrument. Signed-in only.
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rows = await getLiveInstruments();
  return NextResponse.json(
    { at: Date.now(), rows: rows.map((r) => ({ s: r.symbol, p: r.price, c: r.change_pct, h: r.high_24h, l: r.low_24h })) },
    { headers: { "Cache-Control": "private, max-age=2" } },
  );
}
