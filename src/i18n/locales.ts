export const SUPPORTED_LOCALES = [
  "ar",
  "en",
  "fr",
  "es",
  "pt",
  "zh",
  "hi",
  "ur",
  "id",
  "vi",
  "th",
  "bn",
  "sw",
] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ar";
export const LOCALE_COOKIE = "locale";

const RTL_LOCALES: readonly Locale[] = ["ar", "ur"];

export function isSupportedLocale(value: string | undefined): value is Locale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function isRtlLocale(locale: Locale): boolean {
  return RTL_LOCALES.includes(locale);
}
