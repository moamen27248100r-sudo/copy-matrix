"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { translateAuthError } from "@/lib/auth-errors";
import { checkRateLimit } from "@/lib/rate-limit";

const RATE_LIMIT_MESSAGE = "محاولات كثيرة جدًا. يرجى الانتظار قليلًا قبل إعادة المحاولة.";

async function getSiteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}`;
}

export async function login(formData: FormData) {
  if (!(await checkRateLimit("login", 10, 300))) {
    redirect(`/login?error=${encodeURIComponent(RATE_LIMIT_MESSAGE)}`);
  }

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
  if (!(await checkRateLimit("signup", 5, 600))) {
    redirect(`/signup?error=${encodeURIComponent(RATE_LIMIT_MESSAGE)}`);
  }

  const accountType = formData.get("accountType") === "real" ? "real" : "demo";
  const phoneCountryCode = (formData.get("phoneCountryCode") as string) ?? "";
  const phoneNumber = ((formData.get("phoneNumber") as string) ?? "").replace(/\D/g, "");
  const phone = phoneNumber ? `${phoneCountryCode}${phoneNumber}` : null;

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    options: {
      data: {
        display_name: formData.get("displayName") as string,
        account_type: accountType,
        phone,
      },
    },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(translateAuthError(error.message))}`);
  }

  // If email confirmation isn't required, signUp() already returns an
  // active session — skip the "check your email" step entirely and let
  // the customer choose demo vs. real before landing on the dashboard.
  if (data.session) {
    redirect("/onboarding/account-type");
  }

  redirect("/signup/check-email");
}

export async function chooseAccountType(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const accountType = formData.get("accountType") === "real" ? "real" : "demo";
  const balance = accountType === "real" ? 0 : 1000;

  await supabase.from("profiles").update({ account_type: accountType, balance }).eq("id", user.id);

  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(formData: FormData) {
  if (!(await checkRateLimit("password-reset", 5, 900))) {
    redirect(`/forgot-password?error=${encodeURIComponent(RATE_LIMIT_MESSAGE)}`);
  }

  const supabase = await createClient();
  const email = formData.get("email") as string;
  const siteUrl = await getSiteUrl();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/confirm?next=/reset-password`,
  });

  if (error) {
    redirect(`/forgot-password?error=${encodeURIComponent(translateAuthError(error.message))}`);
  }

  redirect("/forgot-password/check-email");
}

export async function updatePassword(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      "/forgot-password?error=" +
        encodeURIComponent("انتهت صلاحية رابط إعادة التعيين. يرجى طلب رابط جديد."),
    );
  }

  const password = formData.get("password") as string;
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/reset-password?error=${encodeURIComponent(translateAuthError(error.message))}`);
  }

  redirect("/dashboard");
}
