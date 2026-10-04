import type { Metadata, Viewport } from "next";
import {
  IBM_Plex_Sans_Arabic,
  Inter,
  Noto_Sans_SC,
  Noto_Sans_Devanagari,
  Noto_Sans_Thai,
  Noto_Sans_Bengali,
} from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { isRtlLocale, type Locale } from "@/i18n/locales";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import { SEARCH_INDEXING_ENABLED } from "@/lib/indexing";
import "./globals.css";

// Platform typography (applied centrally in globals.css via :lang()):
//   Arabic / Urdu  -> IBM Plex Sans Arabic
//   Latin + digits -> Inter (first in every stack, so numerals are always Inter)
//   zh / hi / th / bn -> the matching Noto Sans family
// The Noto families are not preloaded: the browser fetches a face only when
// its script is actually rendered.
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

const notoSC = Noto_Sans_SC({
  variable: "--font-noto-sc",
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: false,
});

const notoDevanagari = Noto_Sans_Devanagari({
  variable: "--font-noto-devanagari",
  subsets: ["devanagari", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: false,
});

const notoThai = Noto_Sans_Thai({
  variable: "--font-noto-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: false,
});

const notoBengali = Noto_Sans_Bengali({
  variable: "--font-noto-bengali",
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  preload: false,
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
  const messages = await getMessages();
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
      className={`${plexSansArabic.variable} ${inter.variable} ${notoSC.variable} ${notoDevanagari.variable} ${notoThai.variable} ${notoBengali.variable} h-full antialiased`}
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
