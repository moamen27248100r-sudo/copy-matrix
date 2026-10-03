"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function markAllRead() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .eq("is_read", false);

  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}

export async function markOneRead(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const id = formData.get("id") as string;

  await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id)
    .eq("user_id", user.id);

  revalidatePath("/notifications");
}

const PREFERENCE_CATEGORIES = ["trades", "copy", "account"] as const;

// Per-category in-app delivery. Security alerts are not configurable. The DB
// (notifications_respect_preferences trigger) enforces what is saved here.
export async function saveNotificationPreferences(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const rows = PREFERENCE_CATEGORIES.map((category) => ({
    user_id: user.id,
    category,
    in_app: formData.get(`cat_${category}`) === "on",
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("notification_preferences").upsert(rows, { onConflict: "user_id,category" });

  revalidatePath("/notifications/preferences");
  redirect(`/notifications/preferences?${error ? "error=1" : "saved=1"}`);
}
