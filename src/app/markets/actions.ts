"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { instrumentBySymbol } from "@/lib/markets";

// The star on an instrument: adds it to / removes it from the customer's watchlist.
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
  // only same-site paths
  redirect(returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/discover?tab=markets");
}
