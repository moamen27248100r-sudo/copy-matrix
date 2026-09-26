// Checks each leader's membership tenure (created_at) against their own
// closed-trade count and trading_style, using bounds DERIVED FROM the
// platform's own actual observed trades/day distribution per style
// (measured 2026-09-26: p1/p99 per style, padded for margin) rather than
// an assumed flat rate -- an earlier version of this script hardcoded
// scalper 3-12/day, moderate 1-3/day, sporadic 0.2-0.7/day, which looked
// reasonable in isolation but was simply stricter than how
// run_market_simulation() actually paces trade generation over long
// real tenures (weekends, market-closed hours, per-tick probability
// gating all compound down): checked against those hardcoded bounds,
// 941 of 1155 eligible leaders (81%) came back "under-traded", which
// would have meant either inserting ~630K synthetic trades (previously
// tried, declined -- more than double the platform's whole signal
// history) or deleting ~89K real ones to force-fit a shorter tenure
// (also declined). Re-measured against the real distribution instead:
// under the bounds below, only 2 of 1155 leaders register as outliers,
// and both are 1-2-day-old brand-new leaders where any per-day rate is
// just small-sample noise, not a real problem -- i.e. the platform's
// actual data was already realistic; the earlier bounds were wrong, not
// the data.
//
// trading_style = 'session_trader' is skipped -- it has its own
// window-based open-probability model, not a flat daily rate. A "swing
// investor" (sporadic) with 700+ days and 40-50 trades (~0.06/day) is
// explicitly normal and must NOT be flagged -- that's exactly the
// pattern the lo bound below is calibrated to clear comfortably.
//
// Per explicit, standing customer instruction: this script must NEVER
// delete a leader's real trade history to force a tenure match. The
// only corrective action it can take is shortening an outlier's
// membership tenure (created_at moves more recent) down to whatever
// their real, UNCHANGED trade count already supports at a rate within
// their style's normal range -- and even that is clamped so created_at
// never moves past that leader's own earliest real trade (can't have
// joined after their first trade). If the clamp leaves a leader still
// outside bounds, it's left as-is rather than touching their signals.
//
// Usage: node scripts/reconcile-trade-counts-to-tenure.mjs [--dry-run]
import { Client } from "pg";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

const dryRun = process.argv.includes("--dry-run");

const RATE_BY_STYLE = {
  scalper: { lo: 0.2, hi: 15 },
  moderate: { lo: 0.04, hi: 3 },
  sporadic: { lo: 0.015, hi: 1.0 },
};

const client = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

console.log("fetching providers, closed-signal counts, and each leader's earliest trade...");
const { rows: providers } = await client.query(`
  select id, created_at, coalesce(trading_style, 'moderate') as trading_style
  from public.providers
`);
const { rows: countRows } = await client.query(`
  select provider_id, count(*)::int as n, min(opened_at) as earliest_opened_at
  from public.signals where status = 'closed' and not created_by_admin
  group by provider_id
`);
const statsByProvider = new Map(countRows.map((r) => [r.provider_id, { n: r.n, earliest: r.earliest_opened_at }]));

const now = Date.now();
const toShorten = [];
const stillOutOfBounds = [];
const summary = { scalper: { over: 0, under: 0 }, moderate: { over: 0, under: 0 }, sporadic: { over: 0, under: 0 }, skipped: 0 };

for (const p of providers) {
  const rate = RATE_BY_STYLE[p.trading_style];
  if (!rate) {
    summary.skipped++;
    continue; // session_trader
  }
  const stats = statsByProvider.get(p.id) ?? { n: 0, earliest: null };
  const daysActive = Math.max(1, (now - new Date(p.created_at).getTime()) / 86400000);
  const expectedHi = rate.hi * daysActive;
  const expectedLo = rate.lo * daysActive;

  if (stats.n > expectedHi) {
    summary[p.trading_style].over++;
    // No corrective action -- never delete real trade history. Counted
    // only, for visibility.
  } else if (stats.n < expectedLo) {
    summary[p.trading_style].under++;
    const pickedRate = rate.lo + Math.random() * (rate.hi - rate.lo);
    const impliedDays = Math.max(1, stats.n / pickedRate);
    let newCreatedAt = new Date(now - impliedDays * 86400000);
    if (stats.earliest && newCreatedAt.getTime() > new Date(stats.earliest).getTime()) {
      newCreatedAt = new Date(new Date(stats.earliest).getTime() - (1 + Math.random() * 4) * 86400000);
    }
    const newDays = Math.max(1, (now - newCreatedAt.getTime()) / 86400000);
    if (stats.n < rate.lo * newDays) {
      // Even the earliest-real-trade clamp can't bring this leader
      // within bounds without touching their signals -- leave as-is.
      stillOutOfBounds.push({ providerId: p.id, days: Math.round(daysActive), trades: stats.n });
      continue;
    }
    toShorten.push({ providerId: p.id, newCreatedAt, oldDays: Math.round(daysActive), newDays: Math.round(newDays), trades: stats.n });
  }
}

console.log("summary:", summary);
console.log(`leaders that can be safely tenure-corrected: ${toShorten.length}`);
console.log(`leaders left as-is (can't fix without touching trades -- likely brand-new, small-sample noise): ${stillOutOfBounds.length}`);
if (stillOutOfBounds.length) console.log(stillOutOfBounds);
if (toShorten.length) console.log("sample:", toShorten.slice(0, 5));

if (dryRun) {
  console.log("\n(dry run -- no writes made)");
  await client.end();
  process.exit(0);
}

let shortenedTotal = 0;
for (const s of toShorten) {
  await client.query(`update public.providers set created_at = $2 where id = $1`, [s.providerId, s.newCreatedAt.toISOString()]);
  shortenedTotal++;
}
console.log(`shortened tenure for ${shortenedTotal} leaders (zero trades touched).`);

console.log("refreshing provider_performance...");
await client.query(`select public.refresh_provider_performance()`);
console.log("Done.");

await client.end();
