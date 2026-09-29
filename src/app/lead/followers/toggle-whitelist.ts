"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOwnProviderId } from "@/lib/lead-trader";

export async function setWhitelistEnabled(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const providerId = await getOwnProviderId(supabase, user.id);
  if (!providerId) redirect("/become-lead-trader");

  const enabled = formData.get("enabled") === "true";
  await supabase.from("lead_trader_profiles").upsert({ provider_id: providerId, whitelist_enabled: enabled }, { onConflict: "provider_id" });

  revalidatePath("/lead/followers");
}
