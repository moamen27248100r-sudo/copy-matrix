// Points every provider's avatar_url at its generated market-themed avatar
// (/api/avatar/<id>, see src/lib/avatar-svg.ts). Leaders whose avatar was
// uploaded through the admin panel (Supabase storage URL) are left alone.
// --dry-run prints the summary only.
import { Client } from "pg";
import { config } from "dotenv";
config({ path: ".env.local" });

const dryRun = process.argv.includes("--dry-run");
const client = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

const { rows } = await client.query(`select count(*) filter (where avatar_url like '%/storage/v1/%') uploaded, count(*) total from public.providers`);
console.log(`${rows[0].total} providers, ${rows[0].uploaded} with uploaded avatars (kept)`);

if (!dryRun) {
  const res = await client.query(
    `update public.providers set avatar_url = '/api/avatar/' || id::text || '?v=4'
     where avatar_url is null or avatar_url not like '%/storage/v1/%'`,
  );
  console.log(`updated ${res.rowCount}`);
}
await client.end();
