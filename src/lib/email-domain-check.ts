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
