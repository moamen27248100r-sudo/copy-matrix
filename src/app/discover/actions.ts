"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function followProvider(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const providerId = formData.get("providerId") as string;

  await supabase
    .from("subscriptions")
    .upsert(
      { follower_id: user.id, provider_id: providerId, is_active: true },
      { onConflict: "follower_id,provider_id" },
    );

  revalidatePath("/discover");
  revalidatePath("/dashboard");
}

export async function unfollowProvider(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const providerId = formData.get("providerId") as string;

  await supabase
    .from("subscriptions")
    .update({ is_active: false })
    .eq("follower_id", user.id)
    .eq("provider_id", providerId);

  revalidatePath("/discover");
  revalidatePath("/dashboard");
}
