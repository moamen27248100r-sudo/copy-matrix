import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic, IBM_Plex_Mono, Cairo } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { isRtlLocale, type Locale } from "@/i18n/locales";
import { ImpersonationBanner } from "@/components/ImpersonationBanner";
import "./globals.css";

// One professional typeface for the whole platform (client pages and the
// admin panel alike): IBM Plex Sans Arabic covers both Arabic and Latin
// glyphs in a single family, so Arabic text and Latin/numeric text (prices,
// the brand name) share the same design instead of visibly mismatched
// fonts stitched together at a script boundary.
const plexSansArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-plex-sans-arabic",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

// A second, much heavier family reserved for headlines and hero text --
// IBM Plex Sans Arabic only goes up to 700 (Bold), and a big headline
// set at 700 doesn't read as boldly as one set at Cairo's 800/900
// (ExtraBold/Black). Body copy, buttons and everything else stays on
// plexSansArabic at its normal 400-500 weight.
const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["700", "800", "900"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("General");
  return {
    title: "Copy Matrix",
    description: t("siteDescription"),
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
      className={`${plexSansArabic.variable} ${plexMono.variable} ${cairo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
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
