import { parsePhoneNumberFromString } from "libphonenumber-js/max";

/** The E.164 number (+ and digits) for a national number typed with a country, or null if it is not a real number. */
export function toE164(countryCode: string, iso: string, nationalDigits: string): string | null {
  const digits = nationalDigits.replace(/\D/g, "").replace(/^0+/, "");
  if (!/^\+[1-9][0-9]{0,3}$/.test(countryCode) || !digits) return null;
  try {
    const parsed = parsePhoneNumberFromString(`${countryCode}${digits}`, iso as never);
    if (!parsed || !parsed.isValid()) return null;
    return parsed.number; // E.164
  } catch {
    return null;
  }
}
