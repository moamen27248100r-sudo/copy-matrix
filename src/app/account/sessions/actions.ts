"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Revokes every session of this user except the one making the request.
export async function signOutOtherSessions() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Faccount%2Fsessions");

  const { error } = await supabase.auth.signOut({ scope: "others" });
  revalidatePath("/account/sessions");
  redirect(`/account/sessions?${error ? "error=1" : "done=1"}`);
}
