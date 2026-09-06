// Format alone (isValidEmailFormat) lets through syntactically valid but
// non-existent domains, e.g. "user@example.com" — a real signup must go to
// a domain that can actually receive mail.
//
// This uses DNS-over-HTTPS (a plain fetch, not Node's `dns` module) on
// purpose: raw DNS resolution over UDP/TCP port 53 is blocked in a lot of
// serverless/sandboxed environments, while outbound HTTPS is not — this
// works reliably wherever the app actually runs.
type DohAnswer = { data: string };
type DohResponse = { Answer?: DohAnswer[] };

async function dohQuery(name: string, type: "MX" | "A" | "AAAA"): Promise<DohResponse> {
  const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`, {
    headers: { accept: "application/dns-json" },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`DoH query failed: ${res.status}`);
  return res.json();
}

export async function domainCanReceiveEmail(domain: string): Promise<boolean> {
  // Run all three in parallel rather than falling back sequentially — one
  // slow/unreachable query (MX is occasionally slower to answer than A/AAAA)
  // shouldn't add its full timeout on top of the others'.
  const [mx, a, aaaa] = await Promise.allSettled([
    dohQuery(domain, "MX"),
    dohQuery(domain, "A"),
    dohQuery(domain, "AAAA"),
  ]);

  if (mx.status === "fulfilled") {
    const answers = mx.value.Answer ?? [];
    // RFC 7505 "null MX" (priority 0, target ".") is a domain explicitly
    // declaring it accepts no mail at all — definitive, skip A/AAAA.
    if (answers.some((ans) => /^0\s+\.?$/.test(ans.data))) return false;
    if (answers.length > 0) return true;
  }

  if (a.status === "fulfilled" && (a.value.Answer ?? []).length > 0) return true;
  if (aaaa.status === "fulfilled" && (aaaa.value.Answer ?? []).length > 0) return true;

  return false;
}

// A typo like "hgmail.com" is a real, registered domain with its own
// working mail servers (often a typo-squatter) — domainCanReceiveEmail()
// correctly says it can receive mail, but it's almost certainly not the
// address the customer actually meant to type, and they'd lose access to
// their own account. Catching this needs a different signal: is the typed
// domain one character away from a major, extremely common provider?
const KNOWN_PROVIDERS = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "live.com",
  "msn.com",
  "aol.com",
  "protonmail.com",
];

function levenshteinDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[][] = Array.from({ length: rows }, (_, i) => [i, ...Array(cols - 1).fill(0)]);
  for (let j = 0; j < cols; j++) dp[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[rows - 1][cols - 1];
}

export function likelyTypoOfKnownProvider(domain: string): string | null {
  const lower = domain.toLowerCase();
  if (KNOWN_PROVIDERS.includes(lower)) return null;
  for (const provider of KNOWN_PROVIDERS) {
    if (levenshteinDistance(lower, provider) === 1) return provider;
  }
  return null;
}
