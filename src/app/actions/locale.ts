"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { LOCALE_COOKIE, SUPPORTED_LOCALES, type Locale } from "@/i18n/locales";
import { createClient } from "@/lib/supabase/server";

export async function setLocale(formData: FormData) {
  const locale = formData.get("locale");
  const path = formData.get("path");
  if (typeof locale !== "string" || !(SUPPORTED_LOCALES as readonly string[]).includes(locale)) {
    return;
  }
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale as Locale, {
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
  });
  // Signed in: emails follow the new language too -- the app's own emails
  // (profiles.locale) and Supabase's sign-in emails (user metadata).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await Promise.all([
      supabase.from("profiles").update({ locale }).eq("id", user.id),
      supabase.auth.updateUser({ data: { locale } }),
    ]);
  }
  revalidatePath(typeof path === "string" && path.startsWith("/") ? path : "/");
}

export async function setTimezone(formData: FormData) {
  const tz = formData.get("timezone");
  if (typeof tz !== "string") return;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
  } catch {
    return;
  }
  const cookieStore = await cookies();
  cookieStore.set("tz", tz, { maxAge: 60 * 60 * 24 * 365, path: "/", sameSite: "lax" });
  revalidatePath("/settings");
  redirect("/settings?success=1");
}
