import { createHash } from "node:crypto";

// The password rules for every place a password is set: at least 8 characters, not one of the most
// used passwords, not the customer's own e-mail, and not in a known leak. The leak check sends only
// the first five characters of the password's SHA-1 to Have I Been Pwned (k-anonymity: the password
// and its full hash never leave the server); when that service does not answer, the local list of
// common passwords is what protects.

export const PASSWORD_MIN = 8;

const COMMON = new Set(
  (
    "password password1 password12 password123 password1234 passw0rd p@ssw0rd p@ssword qwerty qwerty123 qwertyuiop qwerty1234 " +
    "12345678 123456789 1234567890 12345678910 111111111 000000000 11111111 00000000 87654321 987654321 1q2w3e4r 1q2w3e4r5t " +
    "1qaz2wsx qazwsxedc asdfghjk asdfghjkl asdfgh123 zxcvbnm zxcvbnm123 abc12345 abcd1234 abcdefgh abcdefg1 abc123456 " +
    "iloveyou iloveyou1 letmein letmein1 welcome welcome1 welcome123 admin admin123 administrator login login123 master " +
    "monkey monkey123 dragon dragon123 football football1 baseball baseball1 superman batman trustno1 sunshine princess " +
    "starwars whatever shadow michael jennifer jordan23 hunter2 changeme changeme123 default secret secret123 test1234 " +
    "testtest test12345 guest guest123 user user1234 pass1234 pass12345 passpass passpass1 mypassword mypassword1 " +
    "copymatrix copymatrix1 copymatrix123 trading trading123 forex123 bitcoin bitcoin123 crypto123 binance binance123 " +
    "تسجيل123 كلمةالسر مرحبا123 password! password# 12341234 11223344 12121212 123123123 1234qwer qwer1234 qwerasdf " +
    "aaaaaaaa aaaa1111 a1b2c3d4 zaq12wsx 1qazxsw2 q1w2e3r4 q1w2e3r4t5 iloveu123 soccer123 liverpool arsenal chelsea " +
    "666666666 777777777 888888888 999999999 55555555 66666666 77777777 88888888 99999999 123456a a123456 a1234567 a12345678"
  )
    .split(" ")
    .filter(Boolean),
);

export type PasswordIssue = "short" | "common" | "email" | "breached";

/** The rule-based checks (no network): too short, a common password, or the customer's own e-mail. */
export function passwordIssue(password: string, email?: string | null): PasswordIssue | null {
  if (password.length < PASSWORD_MIN) return "short";
  const lower = password.toLowerCase();
  if (COMMON.has(lower) || /^(.)\1+$/.test(password)) return "common";
  const e = (email ?? "").trim().toLowerCase();
  if (e && (lower === e || lower === e.split("@")[0] || (e.split("@")[0].length >= 6 && lower.includes(e.split("@")[0])))) return "email";
  return null;
}

/** True when the password is in a known leak, false when it is not, null when the service did not answer. */
export async function isBreachedPassword(password: string): Promise<boolean | null> {
  const sha1 = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2500);
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true", "User-Agent": "copy-matrix-password-check" },
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = await res.text();
    for (const line of body.split("\n")) {
      const [hash, count] = line.trim().split(":");
      if (hash === suffix && Number(count) > 0) return true;
    }
    return false;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** All checks, in the order a customer should hear about them. */
export async function checkPassword(password: string, email?: string | null): Promise<PasswordIssue | null> {
  const local = passwordIssue(password, email);
  if (local) return local;
  return (await isBreachedPassword(password)) ? "breached" : null;
}
