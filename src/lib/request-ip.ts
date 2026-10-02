import { headers } from "next/headers";

// Vercel sets both of these at the edge on every request that reaches the
// app through its network -- x-forwarded-for can carry a proxy chain, so
// only the first (client-nearest) address is the real one; x-vercel-ip-country
// needs no third-party GeoIP call. Both are absent in local dev.
export async function getRequestIpAndCountry() {
  const headersList = await headers();
  const forwardedFor = headersList.get("x-forwarded-for");
  const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : null;
  const country = headersList.get("x-vercel-ip-country");
  return { ip: ip || null, country: country || null };
}
