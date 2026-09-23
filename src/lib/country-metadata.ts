// Display-only metadata for the small set of leaders given an international
// identity (see scripts/backfill-global-leader-identities.mjs). Every other
// leader has providers.country = null and simply shows no flag.
export type CountryCode =
  | "US" | "GB" | "BE" | "JP" | "DE" | "ZA" | "NG" | "FR" | "IN" | "KR"
  | "CA" | "TR" | "BR" | "NL" | "IT" | "AU" | "ES" | "SE" | "MX" | "ID"
  | "AR" | "CO" | "CL" | "PE" | "PL" | "PT" | "CH" | "AT" | "NO" | "DK"
  | "FI" | "GR" | "IE" | "RU" | "CN" | "TH" | "MY" | "SG" | "PH" | "VN"
  | "PK" | "NZ" | "KE" | "GH" | "MA" | "CZ" | "HU" | "RO" | "UA" | "IL"
  // Arab countries -- assigned to the platform's majority Arabic-named
  // leaders and customers (see scripts/assign-leader-countries.mjs).
  | "SA" | "EG" | "AE" | "KW" | "QA" | "BH" | "OM" | "JO" | "LB" | "IQ"
  | "DZ" | "TN" | "LY" | "SD" | "YE" | "PS" | "SY" | "MR" | "SO" | "DJ";

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
  AR: { nameAr: "الأرجنتين", flag: "🇦🇷" },
  CO: { nameAr: "كولومبيا", flag: "🇨🇴" },
  CL: { nameAr: "تشيلي", flag: "🇨🇱" },
  PE: { nameAr: "بيرو", flag: "🇵🇪" },
  PL: { nameAr: "بولندا", flag: "🇵🇱" },
  PT: { nameAr: "البرتغال", flag: "🇵🇹" },
  CH: { nameAr: "سويسرا", flag: "🇨🇭" },
  AT: { nameAr: "النمسا", flag: "🇦🇹" },
  NO: { nameAr: "النرويج", flag: "🇳🇴" },
  DK: { nameAr: "الدنمارك", flag: "🇩🇰" },
  FI: { nameAr: "فنلندا", flag: "🇫🇮" },
  GR: { nameAr: "اليونان", flag: "🇬🇷" },
  IE: { nameAr: "أيرلندا", flag: "🇮🇪" },
  RU: { nameAr: "روسيا", flag: "🇷🇺" },
  CN: { nameAr: "الصين", flag: "🇨🇳" },
  TH: { nameAr: "تايلاند", flag: "🇹🇭" },
  MY: { nameAr: "ماليزيا", flag: "🇲🇾" },
  SG: { nameAr: "سنغافورة", flag: "🇸🇬" },
  PH: { nameAr: "الفلبين", flag: "🇵🇭" },
  VN: { nameAr: "فيتنام", flag: "🇻🇳" },
  PK: { nameAr: "باكستان", flag: "🇵🇰" },
  NZ: { nameAr: "نيوزيلندا", flag: "🇳🇿" },
  KE: { nameAr: "كينيا", flag: "🇰🇪" },
  GH: { nameAr: "غانا", flag: "🇬🇭" },
  MA: { nameAr: "المغرب", flag: "🇲🇦" },
  CZ: { nameAr: "التشيك", flag: "🇨🇿" },
  HU: { nameAr: "المجر", flag: "🇭🇺" },
  RO: { nameAr: "رومانيا", flag: "🇷🇴" },
  UA: { nameAr: "أوكرانيا", flag: "🇺🇦" },
  IL: { nameAr: "إسرائيل", flag: "🇮🇱" },
  SA: { nameAr: "السعودية", flag: "🇸🇦" },
  EG: { nameAr: "مصر", flag: "🇪🇬" },
  AE: { nameAr: "الإمارات", flag: "🇦🇪" },
  KW: { nameAr: "الكويت", flag: "🇰🇼" },
  QA: { nameAr: "قطر", flag: "🇶🇦" },
  BH: { nameAr: "البحرين", flag: "🇧🇭" },
  OM: { nameAr: "عُمان", flag: "🇴🇲" },
  JO: { nameAr: "الأردن", flag: "🇯🇴" },
  LB: { nameAr: "لبنان", flag: "🇱🇧" },
  IQ: { nameAr: "العراق", flag: "🇮🇶" },
  DZ: { nameAr: "الجزائر", flag: "🇩🇿" },
  TN: { nameAr: "تونس", flag: "🇹🇳" },
  LY: { nameAr: "ليبيا", flag: "🇱🇾" },
  SD: { nameAr: "السودان", flag: "🇸🇩" },
  YE: { nameAr: "اليمن", flag: "🇾🇪" },
  PS: { nameAr: "فلسطين", flag: "🇵🇸" },
  SY: { nameAr: "سوريا", flag: "🇸🇾" },
  MR: { nameAr: "موريتانيا", flag: "🇲🇷" },
  SO: { nameAr: "الصومال", flag: "🇸🇴" },
  DJ: { nameAr: "جيبوتي", flag: "🇩🇯" },
};

export function countryDisplay(code: string | null | undefined) {
  if (!code) return null;
  return COUNTRY_METADATA[code as CountryCode] ?? null;
}

// The original 50-leader curated international roster's country codes
// (see backfill-global-leader-identities.mjs) -- used to pull genuinely
// diverse, non-Arabic-named leaders for the homepage's public "Top
// Traders" section, since a plain highest-return sort is dominated by the
// platform's much larger pool of Arabic-named leaders.
// "MA" (Morocco) is deliberately excluded: it's also in
// assign-leader-countries.mjs's bulk Arabic-name pool, so a leader with
// country="MA" could be either a curated international identity or one of
// the many bulk Arabic-named leaders -- no way to tell them apart by
// country code alone, so it's dropped here to keep this list unambiguous.
export const INTERNATIONAL_COUNTRY_CODES: CountryCode[] = [
  "US", "GB", "BE", "JP", "DE", "ZA", "NG", "FR", "IN", "KR",
  "CA", "TR", "BR", "NL", "IT", "AU", "ES", "SE", "MX", "ID",
  "AR", "CO", "CL", "PE", "PL", "PT", "CH", "AT", "NO", "DK",
  "FI", "GR", "IE", "RU", "CN", "TH", "MY", "SG", "PH", "VN",
  "PK", "NZ", "KE", "GH", "CZ", "HU", "RO", "UA", "IL",
];
