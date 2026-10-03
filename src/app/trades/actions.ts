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

// Sets (or clears, when a field is left empty) the customer's own take-profit /
// stop-loss on one open copied position. Validation against the live price and
// the actual closing both happen in the database.
export async function updatePositionTpSl(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const rawReturn = String(formData.get("returnTo") ?? "/trades");
  const returnTo = rawReturn.startsWith("/") && !rawReturn.startsWith("//") ? rawReturn.split("?")[0] : "/trades";
  const tabQuery = rawReturn.includes("tab=positions") ? "tab=positions&" : rawReturn.includes("tab=open") ? "tab=open&" : "";

  const optionalNumber = (name: string) => {
    const raw = String(formData.get(name) ?? "").trim();
    if (raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : NaN;
  };
  const tp = optionalNumber("takeProfit");
  const sl = optionalNumber("stopLoss");
  const t = await getTranslations("Actions.dashboard");
  const fail = (msg: string) => redirect(`${returnTo}?${tabQuery}error=${encodeURIComponent(msg)}`);

  if ((tp != null && Number.isNaN(tp)) || (sl != null && Number.isNaN(sl))) fail(t("tpSlFailed"));

  const { error } = await supabase.rpc("set_my_position_tp_sl", {
    p_position_id: String(formData.get("positionId") ?? ""),
    p_take_profit: tp,
    p_stop_loss: sl,
  });

  if (error) {
    fail(error.code === "CM015" ? t("tpInvalid") : error.code === "CM016" ? t("slInvalid") : t("tpSlFailed"));
  }

  revalidatePath("/trades");
  revalidatePath("/portfolio");
  redirect(`${returnTo}?${tabQuery}tpsl=saved`);
}
