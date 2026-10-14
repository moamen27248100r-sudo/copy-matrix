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
