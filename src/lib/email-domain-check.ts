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
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`DoH query failed: ${res.status}`);
  return res.json();
}

export async function domainCanReceiveEmail(domain: string): Promise<boolean> {
  try {
    const mx = await dohQuery(domain, "MX");
    const answers = mx.Answer ?? [];
    // RFC 7505 "null MX" (priority 0, target ".") is a domain explicitly
    // declaring it accepts no mail at all — definitive, no A/AAAA fallback.
    if (answers.some((a) => /^0\s+\.?$/.test(a.data))) return false;
    if (answers.length > 0) return true;
  } catch {
    // lookup failed — fall through to the A/AAAA fallback below
  }

  try {
    const a = await dohQuery(domain, "A");
    if ((a.Answer ?? []).length > 0) return true;
  } catch {
    // try AAAA next
  }

  try {
    const aaaa = await dohQuery(domain, "AAAA");
    return (aaaa.Answer ?? []).length > 0;
  } catch {
    return false;
  }
}
