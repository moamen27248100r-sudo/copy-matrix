import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Logo } from "@/components/Logo";
import type { Locale } from "@/i18n/locales";

// The public header: the logo, the language, and the two ways in. No account menu, no bell, no
// demo strip and no bottom bar -- those exist only for a signed-in customer.
export async function GuestHeader() {
  const t = await getTranslations("Nav");
  const locale = (await getLocale()) as Locale;

  return (
    <nav className="sticky top-0 z-[9999] w-full border-b border-border bg-[#0b1726]">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-3 sm:h-16 sm:px-6">
        <Link href="/" className="flex min-h-11 min-w-0 items-center overflow-hidden" aria-label="Copy Matrix">
          <Logo iconClassName="h-4 w-4 sm:h-5 sm:w-5" textClassName="text-base sm:text-xl" />
        </Link>
        <div className="flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-3">
          <LanguageSwitcher currentLocale={locale} />
          <Link
            href="/login"
            className="tap-44 whitespace-nowrap rounded border border-border px-2.5 py-2 text-sm font-medium text-foreground transition hover:bg-surface sm:px-4"
          >
            {t("login")}
          </Link>
          <Link
            href="/signup"
            className="tap-44 whitespace-nowrap rounded bg-accent px-2.5 py-2 text-sm font-medium text-accent-foreground transition hover:bg-accent-hover sm:px-4"
          >
            {t("createAccount")}
          </Link>
        </div>
      </div>
    </nav>
  );
}
