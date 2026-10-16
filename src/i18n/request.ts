import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isSupportedLocale } from "@/i18n/locales";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  // Staff screens stay in Arabic unless a language was picked; everything else starts in English.
  const isAdmin = ((await headers()).get("x-cm-path") ?? "").startsWith("/admin");
  const locale = isSupportedLocale(cookieLocale) ? cookieLocale : isAdmin ? "ar" : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
