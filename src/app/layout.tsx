import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic, Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { isRtlLocale, type Locale } from "@/i18n/locales";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { SEARCH_INDEXING_ENABLED } from "@/lib/indexing";
import { GLOBAL_CLIENT_NAMESPACES, pickMessages } from "@/i18n/client-messages";
import "./globals.css";

// Platform typography (applied centrally in globals.css via :lang()):
//   Arabic / Urdu  -> IBM Plex Sans Arabic
//   Latin + digits -> Inter (first in every stack, so numerals are always Inter)
//   zh / hi / th / bn -> the system face of that script (no web font: the Noto families were
//                        hundreds of @font-face rules, ~370 KB of render-blocking CSS on every page)
const plexSansArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-plex-sans-arabic",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// viewport-fit=cover makes env(safe-area-inset-*) real on iOS Safari / Chrome,
// which the floating bottom nav relies on.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("General");
  return {
    title: "Copy Matrix",
    description: t("siteDescription"),
    ...(SEARCH_INDEXING_ENABLED ? {} : { robots: { index: false, follow: false, googleBot: { index: false, follow: false } } }),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = (await getLocale()) as Locale;
  // Only the namespaces client components read (i18n/client-messages.ts), not the whole catalog.
  const messages = pickMessages(await getMessages(), GLOBAL_CLIENT_NAMESPACES);
  const dir = isRtlLocale(locale) ? "rtl" : "ltr";

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: "Copy Matrix",
        applicationCategory: "FinanceApplication",
        operatingSystem: "Web",
      },
      {
        "@type": "FinancialProduct",
        name: "Copy Matrix",
        description: "Copy trading software platform across crypto, forex, gold and index markets.",
      },
    ],
  };

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${plexSansArabic.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <NextIntlClientProvider messages={messages}>
          <ImpersonationBanner />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
