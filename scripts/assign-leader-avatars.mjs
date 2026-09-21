// Distributes leader pictures with no repeats:
//   - ~25% of leaders get an initials badge (navy / gold / emerald) instead of a photo;
//   - the AI / tech images in AI_TECH_AVATARS are shuffled and popped, so each
//     image goes to exactly ONE leader (the 5 featured on the home page first);
//   - everyone else gets their own generated chart avatar (unique per id).
// Leaders whose picture was uploaded through the admin panel (Supabase storage
// URL) are left alone. Re-running reshuffles.
// Usage: node scripts/assign-leader-avatars.mjs [--dry-run]
import { Client } from "pg";
import { config } from "dotenv";
import { AI_TECH_AVATARS } from "../src/lib/leader-avatar-library.mjs";
config({ path: ".env.local" });

const dryRun = process.argv.includes("--dry-run");
const VERSION = 3; // AVATAR_VERSION in src/lib/avatar-url.ts
const INITIALS_SHARE = 0.25;
const FEATURED = 5;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Same pinning as src/lib/pin-top-leaders.ts.
function pinTopLeaders(list) {
  const anas = list.find((p) => p.display_name === "أنس ريان");
  const youssef = list.find((p) => p.display_name === "يوسف علي");
  if (!anas && !youssef) return list;
  const rest = list.filter((p) => p.display_name !== "أنس ريان" && p.display_name !== "يوسف علي");
  const out = [];
  if (anas) out.push(anas);
  if (rest[0]) out.push(rest[0]);
  if (youssef) out.push(youssef);
  out.push(...rest.slice(1));
  return out;
}

async function isLive(url) {
  // Two attempts: a single slow response must not drop an image from the pool.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(20000) });
      if (res.ok && (res.headers.get("content-type") ?? "").startsWith("image/")) return true;
      if (res.status === 404) return false;
    } catch {
      /* retry */
    }
  }
  return false;
}

const client = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

const { rows: all } = await client.query(`select id, avatar_url from public.providers`);
const eligible = all.filter((r) => !(r.avatar_url ?? "").includes("/storage/v1/"));

const { rows: top } = await client.query(
  `select provider_id as id, display_name from public.provider_cards order by avg_daily_return_pct desc nulls last limit 10`,
);
const featuredIds = pinTopLeaders(top).slice(0, FEATURED).map((f) => f.id);

const liveFlags = await Promise.all(AI_TECH_AVATARS.map(isLive));
const pool = shuffle(AI_TECH_AVATARS.filter((_, i) => liveFlags[i]));
console.log(`${pool.length}/${AI_TECH_AVATARS.length} images live`);

const chart = (id) => `/api/avatar/${id}?v=${VERSION}`;
const initials = (id) => `/api/avatar/${id}?v=${VERSION}&k=i`;

const assign = new Map();
const featured = eligible.filter((r) => featuredIds.includes(r.id));
const others = shuffle(eligible.filter((r) => !featuredIds.includes(r.id)));

for (const r of featured) assign.set(r.id, pool.length ? pool.pop() : chart(r.id)); // pop: never reused
const initialsCount = Math.round(eligible.length * INITIALS_SHARE);
others.forEach((r, i) => {
  if (i < initialsCount) assign.set(r.id, initials(r.id));
  else assign.set(r.id, pool.length ? pool.pop() : chart(r.id));
});

const urls = [...assign.values()];
const photos = urls.filter((u) => u.startsWith("https://"));
if (new Set(urls).size !== urls.length) throw new Error("duplicate avatar URL assigned");
console.log(`eligible ${eligible.length}: ${photos.length} photos, ${urls.filter((u) => u.endsWith("&k=i")).length} initials, ${urls.length - photos.length - urls.filter((u) => u.endsWith("&k=i")).length} charts; all distinct`);

if (!dryRun) {
  const ids = [...assign.keys()];
  const CHUNK = 500;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    await client.query(
      `update public.providers p set avatar_url = v.url
       from (select unnest($1::uuid[]) as id, unnest($2::text[]) as url) v where p.id = v.id`,
      [slice, slice.map((id) => assign.get(id))],
    );
  }
  console.log("done");
}
await client.end();
