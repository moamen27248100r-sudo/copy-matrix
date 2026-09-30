"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function runOwnSettlement() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.rpc("lead_trader_run_own_settlement");

  revalidatePath("/lead/settlements");
  revalidatePath("/lead");
}

const PAYOUT_ERRORS: Record<string, string> = {
  LT020: "payoutErrMin",
  LT021: "payoutErrDestination",
  LT022: "payoutErrPending",
  LT023: "payoutErrAvailable",
};

// The amount check against settled earnings happens in the database function
// (lead_dashboard_request_payout), not here -- this only forwards the input.
export async function requestPayout(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const amount = Number(formData.get("amount"));
  const destination = String(formData.get("destination") ?? "");
  const { error } = await supabase.rpc("lead_dashboard_request_payout", { p_amount: amount, p_destination: destination });
  revalidatePath("/lead/settlements");
  if (error) redirect("/lead/settlements?err=" + (PAYOUT_ERRORS[error.code ?? ""] ?? "payoutErrGeneric"));
  redirect("/lead/settlements?ok=1");
}

export async function cancelPayout(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.rpc("lead_dashboard_cancel_payout", { p_id: String(formData.get("id") ?? "") });
  revalidatePath("/lead/settlements");
}
