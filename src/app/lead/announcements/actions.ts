"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getOwnProviderId } from "@/lib/lead-trader";

async function requireLeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await getOwnProviderId(supabase, user.id))) redirect("/become-lead-trader");
  return supabase;
}

// Posting inserts the announcement and notifies every active copier in one
// database call (lead_trader_post_announcement, 0202).
export async function sendAnnouncement(formData: FormData) {
  const supabase = await requireLeader();
  const body = ((formData.get("body") as string) ?? "").trim().slice(0, 280);
  if (!body) redirect("/lead/announcements?err=empty");
  const { error } = await supabase.rpc("lead_trader_post_announcement", { p_body: body });
  if (error) redirect("/lead/announcements?err=failed");
  revalidatePath("/lead/announcements");
  redirect("/lead/announcements?ok=1");
}

export async function deleteAnnouncement(formData: FormData) {
  const supabase = await requireLeader();
  await supabase.rpc("lead_trader_delete_announcement", { p_id: String(formData.get("id") ?? "") });
  revalidatePath("/lead/announcements");
}
