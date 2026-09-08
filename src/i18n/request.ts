import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE } from "@/i18n/locales";

// Arabic-only platform, always — the language switcher that used to let a
// visitor set a different locale cookie has been removed, but a visitor who
// used it before this change would otherwise stay stuck in that language
// for up to a year (the cookie's lifetime). Ignoring it here closes that
// gap unconditionally, not just for new visitors.
export default getRequestConfig(async () => {
  return {
    locale: DEFAULT_LOCALE,
    messages: (await import(`../messages/${DEFAULT_LOCALE}.json`)).default,
  };
});
