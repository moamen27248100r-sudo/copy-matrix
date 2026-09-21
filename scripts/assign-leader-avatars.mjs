// Assigns every provider a random avatar from FX_ZULUTRADE_AVATARS
// (providers.avatar_url). Each URL is checked first so dead links are never
// written. Leaders whose avatar was uploaded through the admin panel
// (Supabase storage URL) are left alone. --dry-run prints the summary only.
import { Client } from "pg";
import { config } from "dotenv";
import { FX_ZULUTRADE_AVATARS } from "../src/lib/leader-avatar-library.mjs";
config({ path: ".env.local" });

const dryRun = process.argv.includes("--dry-run");

async function isLive(url) {
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15000) });
    return res.ok && (res.headers.get("content-type") ?? "").startsWith("image/");
  } catch {
    return false;
  }
}

const live = [];
const dead = [];
for (let i = 0; i < FX_ZULUTRADE_AVATARS.length; i += 20) {
  const batch = FX_ZULUTRADE_AVATARS.slice(i, i + 20);
  const results = await Promise.all(batch.map(isLive));
  batch.forEach((u, j) => (results[j] ? live : dead).push(u));
}
console.log(`library ${FX_ZULUTRADE_AVATARS.length}: ${live.length} live, ${dead.length} dead (skipped)`);

const client = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
const { rows } = await client.query(`select id, avatar_url from public.providers`);
const updates = rows
  .filter((r) => !(r.avatar_url ?? "").includes("/storage/v1/"))
  .map((r) => ({ id: r.id, url: live[Math.floor(Math.random() * live.length)] }));
console.log(`${rows.length} providers, ${updates.length} to update, ${new Set(updates.map((u) => u.url)).size} distinct avatars`);

if (!dryRun) {
  const CHUNK = 500;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const chunk = updates.slice(i, i + CHUNK);
    await client.query(
      `update public.providers p set avatar_url = v.url
       from (select unnest($1::uuid[]) as id, unnest($2::text[]) as url) v
       where p.id = v.id`,
      [chunk.map((c) => c.id), chunk.map((c) => c.url)],
    );
  }
  console.log("done");
}
await client.end();
