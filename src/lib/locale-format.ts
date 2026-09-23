import type { Locale } from "@/i18n/locales";

// A concrete BCP-47 tag per supported UI locale, picked to match a real,
// large speaker population of that language (also the same countries used
// to diversify the leader roster -- see assign-language-leader-countries.mjs).
// Bare language codes ("ar", "zh") work with Intl too, but a real region
// gives a more natural default (digit style, date order) than the ICU
// default for the language alone.
const BCP47: Record<Locale, string> = {
  ar: "ar-EG",
  en: "en-US",
  fr: "fr-FR",
  es: "es-ES",
  pt: "pt-BR",
  zh: "zh-CN",
  hi: "hi-IN",
  ur: "ur-PK",
  id: "id-ID",
  vi: "vi-VN",
  th: "th-TH",
  bn: "bn-BD",
  sw: "sw-KE",
};

export function localeTag(locale: Locale): string {
  return BCP47[locale] ?? "en-US";
}

export function formatDate(iso: string | null | undefined, locale: Locale, options?: Intl.DateTimeFormatOptions): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(localeTag(locale), options);
}

export function formatDateTime(iso: string | null | undefined, locale: Locale, options?: Intl.DateTimeFormatOptions): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(localeTag(locale), options);
}

const RELATIVE_UNITS: { unit: Intl.RelativeTimeFormatUnit; ms: number }[] = [
  { unit: "year", ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: "month", ms: 30 * 24 * 60 * 60 * 1000 },
  { unit: "day", ms: 24 * 60 * 60 * 1000 },
  { unit: "hour", ms: 60 * 60 * 1000 },
  { unit: "minute", ms: 60 * 1000 },
];

// Intl.RelativeTimeFormat handles each language's own plural/dual rules
// natively ("an hour ago" vs "2 hours ago" vs "ساعتين" vs "2 heures"),
// so this needs no per-language grammar of its own.
export function formatRelativeTime(iso: string, locale: Locale): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const rtf = new Intl.RelativeTimeFormat(localeTag(locale), { numeric: "auto" });
  for (const { unit, ms } of RELATIVE_UNITS) {
    const value = Math.floor(diffMs / ms);
    if (value >= 1) return rtf.format(-value, unit);
  }
  return rtf.format(0, "minute");
}
