// One-time redistribution of providers.base_followers_count into
// risk-tiered ranges (customer's explicit spec):
//   trading_status = 'stopped' (margined/dead)          -> 0
//   risk_level = 'منخفضة' (low risk)                    -> 150-600,
//     with the top ~5% by rating_score (tier = 'نخبة')   -> 1200-2500
//   risk_level = 'متوسطة' (moderate)                    -> 25-120
//   risk_level = 'مرتفعة' (high risk)                    -> 3-15
//
// Reads the true risk_level/tier from provider_cards (percentile-based,
// only cheaply available as a view, not per-row inline in the live
// simulation function -- see 0169's own note on this). The live function's
// ongoing v_follower_cap only approximates this via risk_archetype; this
// backfill is the one place the REAL risk_level tiers get applied exactly.
//
// Usage: node scripts/redistribute-follower-counts.mjs [--dry-run]
import { Client } from "pg";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

const dryRun = process.argv.includes("--dry-run");

function logUniform(min, max) {
  return min * Math.pow(max / min, Math.random());
}

const client = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

const { rows } = await client.query(
  `select provider_id, risk_level, tier, trading_status from public.provider_cards`,
);
console.log(`${rows.length} providers`);

const updates = rows.map((p) => {
  let count;
  if (p.trading_status === "stopped") {
    count = 0;
  } else if (p.risk_level === "منخفضة") {
    count = p.tier === "نخبة" && Math.random() < 0.05
      ? Math.round(logUniform(1200, 2500))
      : Math.round(logUniform(150, 600));
  } else if (p.risk_level === "متوسطة") {
    count = Math.round(logUniform(25, 120));
  } else if (p.risk_level === "مرتفعة") {
    count = Math.round(logUniform(3, 15));
  } else {
    count = Math.round(logUniform(25, 120)); // unknown/null risk_level -- treat as moderate
  }
  return { id: p.provider_id, count, riskLevel: p.risk_level, stopped: p.trading_status === "stopped" };
});

const byTier = { stopped: 0, low: 0, moderate: 0, high: 0, unknown: 0 };
for (const u of updates) {
  if (u.stopped) byTier.stopped++;
  else if (u.riskLevel === "منخفضة") byTier.low++;
  else if (u.riskLevel === "متوسطة") byTier.moderate++;
  else if (u.riskLevel === "مرتفعة") byTier.high++;
  else byTier.unknown++;
}
console.log("distribution by tier:", byTier);
console.log("sample:", updates.slice(0, 10));

if (dryRun) {
  console.log("\n(dry run -- no writes made)");
  await client.end();
  process.exit(0);
}

const CHUNK = 500;
for (let i = 0; i < updates.length; i += CHUNK) {
  const chunk = updates.slice(i, i + CHUNK);
  await client.query(
    `update public.providers p set base_followers_count = v.count
     from unnest($1::uuid[], $2::int[]) as v(id, count)
     where p.id = v.id`,
    [chunk.map((u) => u.id), chunk.map((u) => u.count)],
  );
  process.stdout.write(`\rupdated: ${Math.min(i + CHUNK, updates.length)}/${updates.length}`);
}
console.log("\ndone. Refreshing provider_performance_mv...");
await client.query(`select public.refresh_provider_performance()`);
console.log("Done.");

await client.end();
