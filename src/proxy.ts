import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { LOCALE_COOKIE, SUPPORTED_LOCALES, DEFAULT_LOCALE, type Locale } from "@/i18n/locales";

// Parses an Accept-Language header ("en-US,en;q=0.9,ar;q=0.8") into base
// language codes ordered by descending preference (quality value), so a
// browser/phone set to e.g. "en-GB" still matches our "en" locale.
function parsePreferredLocales(header: string): string[] {
  return header
    .split(",")
    .map((part) => {
      const [tag, qPart] = part.trim().split(";q=");
      const q = qPart ? Number(qPart) : 1;
      const base = tag.split("-")[0].toLowerCase();
      return { base, q: Number.isFinite(q) ? q : 1 };
    })
    .sort((a, b) => b.q - a.q)
    .map((entry) => entry.base);
}

function detectLocale(request: NextRequest): Locale {
  const header = request.headers.get("accept-language");
  if (!header) return DEFAULT_LOCALE;
  const preferred = parsePreferredLocales(header);
  const match = preferred.find((base) => (SUPPORTED_LOCALES as readonly string[]).includes(base));
  return (match as Locale) ?? DEFAULT_LOCALE;
}

export async function proxy(request: NextRequest) {
  const response = await updateSession(request);

  // Only ever set this on a customer's very first visit (no cookie yet) --
  // never overrides a locale the customer (or the LanguageSwitcher's own
  // setLocale action) already chose, explicitly or via an earlier auto-
  // detection. /admin is excluded: staff always land on the default
  // Arabic admin UI regardless of their own browser language, per the
  // platform's admin-stays-Arabic convention.
  if (!request.nextUrl.pathname.startsWith("/admin") && !request.cookies.has(LOCALE_COOKIE)) {
    response.cookies.set(LOCALE_COOKIE, detectLocale(request), {
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
    });
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/avatar/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
