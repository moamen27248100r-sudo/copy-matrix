"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const KNOWN_ERRORS: [string, string][] = [
  ["Invalid login credentials", "البريد الإلكتروني أو كلمة المرور غير صحيحة."],
  ["Email not confirmed", "لم يتم تأكيد البريد الإلكتروني بعد. يرجى فتح رابط التأكيد المرسل إليك."],
  ["User already registered", "هذا البريد الإلكتروني مسجَّل بالفعل. يرجى تسجيل الدخول."],
  ["Password should be at least", "كلمة المرور يجب أن تتكوّن من ٦ أحرف على الأقل."],
  ["is invalid", "البريد الإلكتروني المُدخل غير صالح."],
  ["only request this after", "يرجى الانتظار قليلًا قبل إعادة المحاولة."],
];

function translateAuthError(message: string): string {
  const match = KNOWN_ERRORS.find(([needle]) => message.includes(needle));
  return match ? match[1] : "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.";
}

export async function login(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(translateAuthError(error.message))}`);
  }

  redirect("/dashboard");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    options: {
      data: {
        display_name: formData.get("displayName") as string,
      },
    },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(translateAuthError(error.message))}`);
  }

  redirect("/signup/check-email");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
