import { isValidPhoneNumber, validatePhoneNumberLength } from "libphonenumber-js/max";

// Requires a real-looking domain with a dot and a TLD of at least 2 letters
// (rejects things like "test@test" or "a@b").
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

export function isValidEmailFormat(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

// The country-code selector already supplies the international prefix, so a
// leading trunk "0" (e.g. Egypt's local "01xxxxxxxxx") must never be typed
// after it — strip it the same way for every country.
export function stripTrunkZero(digitsOnly: string): string {
  return digitsOnly.replace(/^0+/, "");
}

export function isValidPhoneForCountry(nationalNumber: string, iso: string): boolean {
  if (!nationalNumber) return false;
  try {
    return isValidPhoneNumber(nationalNumber, iso as never);
  } catch {
    return false;
  }
}

// True while the digits typed so far can't possibly be a complete number yet
// for this country — used to hold off showing a "wrong number" error until
// the client has actually finished typing, not after the first keystroke.
export function isPhoneStillTooShort(nationalNumber: string, iso: string): boolean {
  if (!nationalNumber) return true;
  try {
    return validatePhoneNumberLength(nationalNumber, iso as never) === "TOO_SHORT";
  } catch {
    return true;
  }
}
