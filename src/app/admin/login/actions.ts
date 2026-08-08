"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

const RATE_LIMIT_MESSAGE = "محاولات كثيرة جدًا. يرجى الانتظار قليلًا قبل إعادة المحاولة.";
const DENIED_MESSAGE = "هذا الحساب لا يملك صلاحية الوصول إلى لوحة الإدارة.";
const INVALID_MESSAGE = "بيانات الدخول غير صحيحة.";

export async function adminLogin(formData: FormData) {
  if (!(await checkRateLimit("admin-login", 8, 300))) {
    redirect(`/admin/login?error=${encodeURIComponent(RATE_LIMIT_MESSAGE)}`);
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  });

  if (error || !data.user) {
    redirect(`/admin/login?error=${encodeURIComponent(INVALID_MESSAGE)}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", data.user.id)
    .single();

  if (!profile?.is_admin) {
    await supabase.auth.signOut();
    redirect(`/admin/login?error=${encodeURIComponent(DENIED_MESSAGE)}`);
  }

  redirect("/admin");
}
