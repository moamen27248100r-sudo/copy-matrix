import { isValidPhoneNumber } from "libphonenumber-js";

// Requires a real-looking domain with a dot and a TLD of at least 2 letters
// (rejects things like "test@test" or "a@b").
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

export function isValidEmailFormat(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export function isValidPhoneForCountry(nationalNumber: string, iso: string): boolean {
  if (!nationalNumber) return false;
  try {
    return isValidPhoneNumber(nationalNumber, iso as never);
  } catch {
    return false;
  }
}
