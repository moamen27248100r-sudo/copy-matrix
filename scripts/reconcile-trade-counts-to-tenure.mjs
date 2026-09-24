// Retroactively trims each leader's closed-trade COUNT down when it's
// implausibly high for their own tenure x trading_style (customer's
// explicit daily-rate spec). trading_style = 'session_trader' is skipped
// -- it already has its own window-based open-probability model, not a
// flat daily rate.
//
// Daily-rate bounds (upper bound enforced; the lower bound is NOT
// backfilled -- see below):
//   scalper                 : 3-12/day
//   moderate ("day trader") : 1-3/day
//   sporadic ("swing trader"): 0.2-0.7/day (~2-5/week)
//
// Over the expected range: deletes a random sample of that leader's own
// closed signals -- excluding any signal with a dependent simulated_positions
// row (that FK cascades on delete, and simulated_positions can belong to a
// REAL subscriber's mirrored trade; synthetic_customer_withdrawals.signal_id
// is "on delete set null" and safe either way, confirmed live).
//
// Deliberately NOT backfilling the lower bound: many leaders have been
// "active" for 1-2+ years (founding-timeline seed), so 3-12/day compounds
// to an implied minimum of thousands of trades per leader -- a first
// --dry-run came back needing 629,838 new signals (more than double the
// platform's entire ~298K existing history), which the customer explicitly
// declined given the runtime and the sheer visible change in every leader's
// trade count. Only the "too many for a beginner-ish tenure" direction is
// corrected; a genuinely thin history is left as-is.
//
// MUST run after clamp-outlier-trade-percentages.mjs, and MUST be followed
// by a full node scripts/backfill-synthetic-customers.mjs reseed (customer
// capital histories replay these exact signals).
//
// Usage: node scripts/reconcile-trade-counts-to-tenure.mjs [--dry-run]
import { Client } from "pg";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

const dryRun = process.argv.includes("--dry-run");

const RATE_BY_STYLE = {
  scalper: { lo: 3, hi: 12 },
  moderate: { lo: 1, hi: 3 },
  sporadic: { lo: 0.2, hi: 0.7 },
};

const client = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

console.log("fetching providers and closed-signal counts...");
const { rows: providers } = await client.query(`
  select id, created_at, coalesce(trading_style, 'moderate') as trading_style
  from public.providers
`);
const { rows: countRows } = await client.query(`
  select provider_id, count(*)::int as n
  from public.signals where status = 'closed' and not created_by_admin
  group by provider_id
`);
const countByProvider = new Map(countRows.map((r) => [r.provider_id, r.n]));

const now = Date.now();
const toDelete = [];
const summary = { scalper: { over: 0, under: 0 }, moderate: { over: 0, under: 0 }, sporadic: { over: 0, under: 0 }, skipped: 0 };

for (const p of providers) {
  const rate = RATE_BY_STYLE[p.trading_style];
  if (!rate) {
    summary.skipped++;
    continue; // session_trader
  }
  const daysActive = Math.max(1, (now - new Date(p.created_at).getTime()) / 86400000);
  const expectedHi = Math.round(rate.hi * daysActive);
  const expectedLo = Math.round(rate.lo * daysActive);
  const actual = countByProvider.get(p.id) ?? 0;

  if (actual > expectedHi) {
    summary[p.trading_style].over++;
    toDelete.push({ providerId: p.id, removeCount: actual - expectedHi });
  } else if (actual < expectedLo) {
    // Deliberately not backfilled -- see header comment (629,838-row dry
    // run, declined). Counted only, for visibility.
    summary[p.trading_style].under++;
  }
}

console.log("summary:", summary);
console.log(`providers needing removal: ${toDelete.length}, total signals to delete: ${toDelete.reduce((s, d) => s + d.removeCount, 0)}`);

if (dryRun) {
  console.log("\n(dry run -- no writes made)");
  await client.end();
  process.exit(0);
}

let deletedTotal = 0;
for (const d of toDelete) {
  const { rows: idsRows } = await client.query(
    `select s.id from public.signals s
     where s.provider_id = $1 and s.status = 'closed' and not s.created_by_admin
       and not exists (select 1 from public.simulated_positions sp where sp.signal_id = s.id)
     order by random() limit $2`,
    [d.providerId, d.removeCount],
  );
  if (idsRows.length === 0) continue;
  await client.query(`delete from public.signals where id = any($1::uuid[])`, [idsRows.map((r) => r.id)]);
  deletedTotal += idsRows.length;
}
console.log(`deleted ${deletedTotal} excess signals. Refreshing provider_performance_mv...`);
await client.query(`select public.refresh_provider_performance()`);
console.log("Done.");

await client.end();
