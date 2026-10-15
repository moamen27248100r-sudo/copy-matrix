import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Header search: traders whose name contains the query (signed-in customers only; the instruments
// are matched in the browser from the static list). At most six, the best rated first.
export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 40);
  if (q.length < 2) return NextResponse.json({ traders: [] });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ traders: [] }, { status: 401 });

  // `%` and `_` are wildcards in ILIKE: match them literally.
  const pattern = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
  const { data } = await supabase
    .from("provider_cards")
    .select("provider_id, display_name, avatar_url, rating_score, risk_level")
    .eq("is_archived", false)
    .ilike("display_name", pattern)
    .order("rating_score", { ascending: false, nullsFirst: false })
    .limit(6);

  return NextResponse.json({
    traders: (data ?? []).map((p) => ({
      id: String(p.provider_id),
      name: p.display_name as string,
      avatarUrl: (p.avatar_url as string | null) ?? null,
      rating: (p.rating_score as number | null) ?? null,
      risk: (p.risk_level as string | null) ?? null,
    })),
  });
}
