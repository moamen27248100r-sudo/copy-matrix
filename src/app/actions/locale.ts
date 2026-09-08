"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALE_COOKIE, SUPPORTED_LOCALES, type Locale } from "@/i18n/locales";

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
  revalidatePath(typeof path === "string" && path.startsWith("/") ? path : "/");
}
