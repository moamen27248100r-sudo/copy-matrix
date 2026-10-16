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
// The platform always opens in English; the language only changes when the visitor picks one in the
// language switcher. There is no detection from the device or browser language.
export const DEFAULT_LOCALE: Locale = "en";
// A new cookie name: the old "locale" cookie was set automatically from the browser language, so it
// is ignored and every visitor starts in English once.
export const LOCALE_COOKIE = "cm_lang";

const RTL_LOCALES: readonly Locale[] = ["ar", "ur"];

export function isSupportedLocale(value: string | undefined): value is Locale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function isRtlLocale(locale: Locale): boolean {
  return RTL_LOCALES.includes(locale);
}
