"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

// Closes one open copied position at today's market price. All the actual
// math (pnl, balance credit, wallet_transactions, notification) happens
// inside close_my_position() (0190) -- same SECURITY DEFINER + auth.uid()
// pattern as stop_copy()/start_or_update_copy(), since simulated_positions
// RLS is select-only for the owning follower.
export async function closePosition(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const positionId = formData.get("positionId") as string;
  const { error } = await supabase.rpc("close_my_position", { p_position_id: positionId });

  if (error) {
    const t = await getTranslations("Actions.dashboard");
    redirect(`/dashboard?error=${encodeURIComponent(error.code === "CM022" ? t("priceStale") : t("closeFailed"))}`);
  }

  revalidatePath("/dashboard");
  revalidatePath("/portfolio");
}

// Reference line for the portfolio chart: a downsampled price series (BTC or gold) from the
// database (benchmark_series, migration 0254). Read-only; the database refuses other symbols.
export async function getBenchmarkSeries(symbol: string, days: number): Promise<{ t: number; p: number }[]> {
  if (symbol !== "BTCUSDT" && symbol !== "XAUUSD") return [];
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const safeDays = Number.isFinite(days) && days > 0 ? Math.min(Math.floor(days), 400) : 0;
  const { data, error } = await supabase.rpc("benchmark_series", { p_symbol: symbol, p_days: safeDays });
  if (error || !Array.isArray(data)) return [];
  return (data as { t: number; p: number }[]).map((r) => ({ t: Number(r.t), p: Number(r.p) }));
}
