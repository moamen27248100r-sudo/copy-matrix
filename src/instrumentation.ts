// Runs once when the production server starts: requests the landing page once
// per language pool from inside the server, which fills its data cache (see
// src/lib/landing-data.ts) before any visitor arrives. After that the cache
// refreshes in the background every hour while the previous copy keeps being
// served, so nobody waits for the slow trader statistics.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;
  const base = `http://127.0.0.1:${process.env.PORT ?? 3000}`;
  setTimeout(() => {
    for (const lang of ["ar", "en"]) {
      fetch(`${base}/`, { headers: { "accept-language": lang, "x-cache-warm": "1" } }).catch(() => {});
    }
  }, 3000);
}
