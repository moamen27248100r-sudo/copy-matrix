import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getHistory, instrumentBySymbol, isRange } from "@/lib/market-data";

// Chart points of one instrument for 1D | 1W | 1M | 3M | 1Y (signed-in only).
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const instrument = instrumentBySymbol(searchParams.get("symbol") ?? "");
  const range = searchParams.get("range");
  if (!instrument || !isRange(range)) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const points = await getHistory(instrument, range);
  return NextResponse.json({ points }, { headers: { "Cache-Control": "private, max-age=60" } });
}
