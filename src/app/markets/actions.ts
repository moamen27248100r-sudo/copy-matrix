"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { instrumentBySymbol } from "@/lib/markets";

// The star on an instrument, from a page that stays where it is (optimistic UI): add / remove.
export async function setWatch(symbol: string, on: boolean) {
  if (!instrumentBySymbol(symbol)) return { ok: false as const };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const };

  const { error } = on
    ? await supabase.from("market_watchlist").upsert({ user_id: user.id, symbol }, { onConflict: "user_id,symbol", ignoreDuplicates: true })
    : await supabase.from("market_watchlist").delete().eq("user_id", user.id).eq("symbol", symbol);
  return { ok: !error };
}

// The star as a plain form (the instrument page): toggles and comes back to the page.
export async function toggleWatch(formData: FormData) {
  const symbol = String(formData.get("symbol") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "/discover?tab=markets");
  if (!instrumentBySymbol(symbol)) redirect("/discover?tab=markets");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fdiscover%3Ftab%3Dmarkets");

  const { data: existing } = await supabase.from("market_watchlist").select("symbol").eq("user_id", user.id).eq("symbol", symbol).maybeSingle();
  if (existing) await supabase.from("market_watchlist").delete().eq("user_id", user.id).eq("symbol", symbol);
  else await supabase.from("market_watchlist").insert({ user_id: user.id, symbol });

  revalidatePath("/discover");
  revalidatePath(`/markets/${symbol}`);
  redirect(returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/discover?tab=markets");
}

// Price alerts (0266): created and cancelled through the database functions, which check the
// instrument, the target and the limit of 20 active alerts. Back to the instrument page either way.
const ALERT_ERRORS: Record<string, string> = { CM061: "invalid", CM062: "same", CM063: "max" };

export async function createPriceAlert(formData: FormData) {
  const symbol = String(formData.get("symbol") ?? "");
  if (!instrumentBySymbol(symbol)) redirect("/discover?tab=markets");
  const target = Number(String(formData.get("target") ?? "").replace(/,/g, ""));
  const back = `/markets/${symbol}`;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(back)}`);

  const { error } = await supabase.rpc("create_price_alert", { p_symbol: symbol, p_target: Number.isFinite(target) ? target : 0 });
  revalidatePath(back);
  revalidatePath("/dashboard");
  redirect(`${back}?alert=${error ? (ALERT_ERRORS[error.code ?? ""] ?? "invalid") : "created"}#alerts`);
}

export async function cancelPriceAlert(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const symbol = String(formData.get("symbol") ?? "");
  const back = instrumentBySymbol(symbol) ? `/markets/${symbol}` : "/discover?tab=markets";
  const supabase = await createClient();
  await supabase.rpc("cancel_price_alert", { p_id: id });
  revalidatePath(back);
  revalidatePath("/dashboard");
  redirect(`${back}#alerts`);
}
