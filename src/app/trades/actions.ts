"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

// Closes every open copied position of the signed-in customer, one at a time
// through the same close_my_position() RPC the per-position button uses
// (all pnl/balance math stays server-side in that function).
export async function closeAllPositions() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: open } = await supabase
    .from("simulated_positions")
    .select("id")
    .eq("follower_id", user.id)
    .eq("status", "open");

  let failed = 0;
  for (const p of open ?? []) {
    const { error } = await supabase.rpc("close_my_position", { p_position_id: p.id });
    if (error) failed++;
  }

  revalidatePath("/trades");
  revalidatePath("/dashboard");
  revalidatePath("/portfolio");
  if (failed > 0) {
    const t = await getTranslations("Actions.dashboard");
    redirect(`/trades?error=${encodeURIComponent(t("closeFailed"))}`);
  }
}
