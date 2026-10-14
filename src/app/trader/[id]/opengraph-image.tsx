import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";
import { fmtReturn, fmtWinRate } from "@/lib/format-stats";
import { isUuid } from "@/lib/uuid";
import { hasEnoughSample } from "@/lib/leader-scores";

// Share image of one leader's page (1200x630): the brand mark and the three
// numbers that matter -- 30-day return, win rate and copiers. The leader's
// name is in the page title / description; the card itself carries only
// numerals and fixed Latin labels so it renders the same for every script.
export const alt = "Copy Matrix";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let roi: number | null = null;
  let win: number | null = null;
  let copiers: number | null = null;
  if (isUuid(id) && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    // provider_cards is public (anon-readable); no cookies, so the image caches.
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false },
    });
    const { data } = await supabase.from("provider_cards").select("roi_30d, win_rate_all, followers_count, trades_30d, closed_signals").eq("provider_id", id).maybeSingle();
    if (data) {
      // fewer than the minimum number of closed trades: no percentage on the share image either
      roi = data.roi_30d != null && hasEnoughSample(data.trades_30d) ? Number(data.roi_30d) : null;
      win = data.win_rate_all != null && hasEnoughSample(data.closed_signals) ? Number(data.win_rate_all) : null;
      copiers = data.followers_count != null ? Number(data.followers_count) : null;
    }
  }

  const stat = (value: string, label: string, color: string) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 88, fontWeight: 700, color }}>{value}</span>
      <span style={{ fontSize: 28, color: "#94a3b8", letterSpacing: 2 }}>{label}</span>
    </div>
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 72,
          background: "#0b0f17",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 19l3-5 3 3 5-9" />
            <path d="M12 8h4v4" />
          </svg>
          <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: -28 }}>
            <path d="M5 19l3-5 3 3 5-9" />
            <path d="M12 8h4v4" />
          </svg>
          <span style={{ color: "#ffffff", fontSize: 56, fontWeight: 700, marginLeft: 8 }}>Copy Matrix</span>
        </div>
        <div style={{ display: "flex", gap: 120 }}>
          {stat(fmtReturn(roi), "30D RETURN", roi != null && roi < 0 ? "#f6465d" : "#0ecb81")}
          {stat(fmtWinRate(win), "WIN RATE", "#ffffff")}
          {stat(copiers != null ? String(copiers) : "—", "COPIERS", "#ffffff")}
        </div>
      </div>
    ),
    { ...size },
  );
}
