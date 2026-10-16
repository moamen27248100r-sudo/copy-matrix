import { createAdminClient } from "@/lib/supabase/admin";

/** Marks the profile's e-mail verified (service role: customers cannot write this column). Server code only. */
export async function markEmailVerified(userId: string) {
  await createAdminClient().from("profiles").update({ email_verified_at: new Date().toISOString() }).eq("id", userId).is("email_verified_at", null);
}
