// Gives every provider one of REAL_LEADER_AVATARS as avatar_url. The pick is a
// pure function of the provider id, so re-running is stable. Leaders whose
// picture was uploaded through the admin panel (Supabase storage URL) are left
// alone. --dry-run prints the summary only.
import { Client } from "pg";
import { config } from "dotenv";
import { REAL_LEADER_AVATARS } from "../src/lib/leader-avatar-library.mjs";
config({ path: ".env.local" });

const dryRun = process.argv.includes("--dry-run");

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const client = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
const { rows } = await client.query(`select id, avatar_url from public.providers`);
const updates = rows
  .filter((r) => !(r.avatar_url ?? "").includes("/storage/v1/"))
  .map((r) => ({ id: r.id, url: REAL_LEADER_AVATARS[fnv1a(r.id) % REAL_LEADER_AVATARS.length] }));
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
