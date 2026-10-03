import { cookies } from "next/headers";

// The IANA timezone chosen in Settings (stored in the "tz" cookie by
// setTimezone). Falls back to UTC when unset or no longer valid.
export async function getUserTimeZone(): Promise<string> {
  const tz = (await cookies()).get("tz")?.value;
  if (!tz) return "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}
