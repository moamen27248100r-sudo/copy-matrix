// Display-only metadata for the small set of leaders given an international
// identity (see scripts/backfill-global-leader-identities.mjs). Every other
// leader has providers.country = null and simply shows no flag.
export type CountryCode =
  | "US" | "GB" | "BE" | "JP" | "DE" | "ZA" | "NG" | "FR" | "IN" | "KR"
  | "CA" | "TR" | "BR" | "NL" | "IT" | "AU" | "ES" | "SE" | "MX" | "ID";

export const COUNTRY_METADATA: Record<CountryCode, { nameAr: string; flag: string }> = {
  US: { nameAr: "الولايات المتحدة", flag: "🇺🇸" },
  GB: { nameAr: "المملكة المتحدة", flag: "🇬🇧" },
  BE: { nameAr: "بلجيكا", flag: "🇧🇪" },
  JP: { nameAr: "اليابان", flag: "🇯🇵" },
  DE: { nameAr: "ألمانيا", flag: "🇩🇪" },
  ZA: { nameAr: "جنوب أفريقيا", flag: "🇿🇦" },
  NG: { nameAr: "نيجيريا", flag: "🇳🇬" },
  FR: { nameAr: "فرنسا", flag: "🇫🇷" },
  IN: { nameAr: "الهند", flag: "🇮🇳" },
  KR: { nameAr: "كوريا الجنوبية", flag: "🇰🇷" },
  CA: { nameAr: "كندا", flag: "🇨🇦" },
  TR: { nameAr: "تركيا", flag: "🇹🇷" },
  BR: { nameAr: "البرازيل", flag: "🇧🇷" },
  NL: { nameAr: "هولندا", flag: "🇳🇱" },
  IT: { nameAr: "إيطاليا", flag: "🇮🇹" },
  AU: { nameAr: "أستراليا", flag: "🇦🇺" },
  ES: { nameAr: "إسبانيا", flag: "🇪🇸" },
  SE: { nameAr: "السويد", flag: "🇸🇪" },
  MX: { nameAr: "المكسيك", flag: "🇲🇽" },
  ID: { nameAr: "إندونيسيا", flag: "🇮🇩" },
};

export function countryDisplay(code: string | null | undefined) {
  if (!code) return null;
  return COUNTRY_METADATA[code as CountryCode] ?? null;
}
