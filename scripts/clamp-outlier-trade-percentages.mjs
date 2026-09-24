// Retroactively fixes every existing closed signal whose %move falls
// outside its leader's risk-tier bound (same tiers as migration
// 0171_tri_tier_pnl_bounds.sql's live retune):
//   low      (flagship/stable/good_rr/else): win 0.4%-2.5%, loss 0.3%-1.8%
//   moderate (struggling):                    win 1.0%-4.5%, loss 0.8%-3.5%
//   high     (high_risk):                     win 5%-15%,   loss 10%-25%
//
// Only exit_price changes -- id/entry_price/side/opened_at/closed_at/symbol
// all stay put, so every FK into this row (synthetic_customer_withdrawals.
// signal_id, etc.) stays valid. This is exactly what fixes a stray outlier
// like a +22% jump sitting among a leader's otherwise 0.5%-3% history.
//
// Must run BEFORE reconcile-trade-counts-to-tenure.mjs (so any newly
// inserted filler trades are already within-bounds) and must be followed
// by a full backfill-synthetic-customers.mjs reseed (customer capital
// histories replay these exact signals).
//
// Usage: node scripts/clamp-outlier-trade-percentages.mjs [--dry-run]
import { Client } from "pg";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

const dryRun = process.argv.includes("--dry-run");

const TIER_BOUNDS = {
  low: { winLo: 0.004, winHi: 0.025, lossLo: 0.003, lossHi: 0.018 },
  moderate: { winLo: 0.010, winHi: 0.045, lossLo: 0.008, lossHi: 0.035 },
  high: { winLo: 0.05, winHi: 0.15, lossLo: 0.10, lossHi: 0.25 },
};

function tierFor(archetype) {
  if (archetype === "high_risk") return "high";
  if (archetype === "struggling") return "moderate";
  return "low"; // flagship, stable, good_rr, balanced/else
}

function logUniform(min, max) {
  return min * Math.pow(max / min, Math.random());
}

const client = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

console.log("fetching closed signals + owning provider archetype...");
const { rows } = await client.query(`
  select s.id, s.entry_price, s.exit_price, s.side, coalesce(p.risk_archetype, 'balanced') as risk_archetype
  from public.signals s
  join public.providers p on p.id = s.provider_id
  where s.status = 'closed' and s.exit_price is not null and not s.created_by_admin
`);
console.log(`${rows.length} closed signals`);

const updates = [];
const byTier = { low: 0, moderate: 0, high: 0 };
const sample = [];

for (const r of rows) {
  const entry = Number(r.entry_price);
  const exit = Number(r.exit_price);
  if (!(entry > 0)) continue;
  const rawPct = (exit - entry) / entry;
  const signedPct = r.side === "sell" ? -rawPct : rawPct;
  const isWin = signedPct >= 0;
  const magnitude = Math.abs(signedPct);

  const tier = tierFor(r.risk_archetype);
  const b = TIER_BOUNDS[tier];
  const [lo, hi] = isWin ? [b.winLo, b.winHi] : [b.lossLo, b.lossHi];

  if (magnitude >= lo && magnitude <= hi) continue; // already within bounds

  byTier[tier]++;
  const newMagnitude = logUniform(lo, hi);
  const newSignedPct = isWin ? newMagnitude : -newMagnitude;
  // Reverse the side-sign to get back to the raw (unsigned-by-side) pct,
  // then apply it to entry_price the same way the live engine does.
  const newRawPct = r.side === "sell" ? -newSignedPct : newSignedPct;
  const newExit = Math.round(entry * (1 + newRawPct) * 10000) / 10000;

  updates.push({ id: r.id, exit: newExit });
  if (sample.length < 15) {
    sample.push(`${r.risk_archetype}/${tier}: ${(signedPct * 100).toFixed(2)}% -> ${(newSignedPct * 100).toFixed(2)}%`);
  }
}

console.log(`outliers by tier:`, byTier, `total: ${updates.length}`);
console.log("sample fixes:\n" + sample.join("\n"));

if (dryRun) {
  console.log("\n(dry run -- no writes made)");
  await client.end();
  process.exit(0);
}

const CHUNK = 500;
for (let i = 0; i < updates.length; i += CHUNK) {
  const chunk = updates.slice(i, i + CHUNK);
  await client.query(
    `update public.signals s set exit_price = v.exit
     from unnest($1::uuid[], $2::numeric[]) as v(id, exit)
     where s.id = v.id`,
    [chunk.map((u) => u.id), chunk.map((u) => u.exit)],
  );
  process.stdout.write(`\rupdated: ${Math.min(i + CHUNK, updates.length)}/${updates.length}`);
}
console.log("\ndone.");

await client.end();
