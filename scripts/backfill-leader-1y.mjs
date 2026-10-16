// Fills the 1Y columns (0273) by refreshing every leader's stats in batches of 50, each in its own
// transaction with no statement limit. Safe to run again: it only recomputes what the nightly job computes.
import pg from "pg";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
await c.query("set statement_timeout = 0");
const { rows } = await c.query("select id from providers order by id");
const ids = rows.map((r) => r.id);
for (let i = 0; i < ids.length; i += 50) {
  await c.query("select public.refresh_provider_stats($1::uuid[], true)", [ids.slice(i, i + 50)]);
  process.stdout.write(`${Math.min(i + 50, ids.length)}/${ids.length} `);
}
const { rows: f } = await c.query("select count(*)::int n, count(roi_365d)::int filled from provider_cards");
console.log(`\n${f[0].filled} of ${f[0].n} leaders have a 1Y return`);
await c.end();
