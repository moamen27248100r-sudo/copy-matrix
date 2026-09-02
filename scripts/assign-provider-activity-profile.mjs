// One-time assignment of a persistent activity personality per provider:
// how often they open trades (activity_weight) and, for a minority,
// which hours of the day they're actually active (session_start_hour /
// session_end_hour, UTC). Bulk UPDATE ... FROM (VALUES ...) in chunks —
// same pattern as assign-provider-capital.mjs, avoids the connection
// drop that ~1900 sequential awaited queries caused earlier.
//
// Usage: node scripts/assign-provider-activity-profile.mjs [--dry-run]
import { Client } from "pg";
import { config } from "dotenv";
config({ path: ".env.local" });

const dryRun = process.argv.includes("--dry-run");

// Named session windows (UTC hours), roughly matching real trading
// sessions, plus a couple of "off-hours only" personalities for variety.
const SESSION_WINDOWS = [
  [0, 8], // Asian session
  [7, 16], // London session
  [12, 21], // New York session
  [18, 2], // evening/night trader (wraps past midnight)
  [9, 13], // short morning-only trader
];

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

function assignActivityWeight() {
  const roll = Math.random();
  if (roll < 0.25) return Math.round(randRange(0.15, 0.5) * 100) / 100; // quiet: a couple of simple trades/day
  if (roll < 0.85) return Math.round(randRange(0.7, 1.3) * 100) / 100; // normal
  return Math.round(randRange(1.8, 3.5) * 100) / 100; // power trader: opens often
}

function assignSession() {
  if (Math.random() < 0.7) return { start: null, end: null }; // trades around the clock
  const [start, end] = SESSION_WINDOWS[Math.floor(Math.random() * SESSION_WINDOWS.length)];
  return { start, end };
}

const db = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await db.connect();

const { rows: providers } = await db.query(`select id from public.providers`);
console.log(`assigning activity profiles for ${providers.length} providers`);

const updates = providers.map((p) => {
  const activityWeight = assignActivityWeight();
  const { start, end } = assignSession();
  return { id: p.id, activityWeight, start, end };
});

if (dryRun) {
  console.log("DRY RUN sample:", updates.slice(0, 8));
  const quiet = updates.filter((u) => u.activityWeight < 0.6).length;
  const power = updates.filter((u) => u.activityWeight > 1.6).length;
  const sessioned = updates.filter((u) => u.start !== null).length;
  console.log(`quiet=${quiet} power=${power} sessioned=${sessioned} of ${updates.length}`);
  await db.end();
  process.exit(0);
}

const CHUNK = 500;
for (let i = 0; i < updates.length; i += CHUNK) {
  const chunk = updates.slice(i, i + CHUNK);
  const values = chunk
    .map((_, j) => `($${j * 4 + 1}::uuid, $${j * 4 + 2}::numeric, $${j * 4 + 3}::smallint, $${j * 4 + 4}::smallint)`)
    .join(",");
  const params = chunk.flatMap((u) => [u.id, u.activityWeight, u.start, u.end]);
  await db.query(
    `update public.providers p set activity_weight = v.activity_weight, session_start_hour = v.session_start_hour, session_end_hour = v.session_end_hour
     from (values ${values}) as v(id, activity_weight, session_start_hour, session_end_hour)
     where p.id = v.id`,
    params,
  );
  process.stdout.write(`\rupdated ${Math.min(i + CHUNK, updates.length)}/${updates.length}`);
}
console.log("\ndone");
await db.end();
