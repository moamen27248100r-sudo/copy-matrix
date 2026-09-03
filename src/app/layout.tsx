import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic, IBM_Plex_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { isRtlLocale, type Locale } from "@/i18n/locales";
import { SupportChatWidget } from "@/components/SupportChatWidget";
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

export const metadata: Metadata = {
  title: "Copy Matrix",
  description: "منصة تداول اجتماعي لمتابعة أفضل المتداولين ونسخ صفقاتهم تلقائيًا.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = (await getLocale()) as Locale;
  const messages = await getMessages();
  const dir = isRtlLocale(locale) ? "rtl" : "ltr";

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${plexSansArabic.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <NextIntlClientProvider messages={messages}>
          {children}
          <SupportChatWidget />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
