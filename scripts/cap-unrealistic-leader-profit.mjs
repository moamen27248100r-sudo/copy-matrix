// Follow-up to fix-leader-withdrawal-ratios.mjs: while fixing withdrawals,
// found total_profit itself was often wildly unrealistic -- 301/1016
// profitable leaders had total_profit more than 20x their current
// account_capital, 140 more than 100x, one as high as 2046x ($5.37M
// profit on $4,147 capital). Correlation with tenure was ~0 (0.012) --
// not "long-tenured leaders compounded over years" (which would at least
// be a defensible story), just runaway compounding with no ceiling in
// the old live formula.
//
// total_profit has no per-trade dollar ledger to exactly resum from (same
// limitation noted throughout this project), so this caps it to a
// plausible multiple of CURRENT account_capital, scaled by how long
// they've been trading (longer tenure = more cumulative profit is
// plausible, up to a ceiling) and by risk archetype (higher risk =
// higher variance, so a higher ceiling). Only ever lowers total_profit
// (never raises an already-plausible one), and re-applies the same
// target-withdrawal-ratio logic afterward so total_withdrawals never
// ends up exceeding the (possibly now much lower) total_profit.
//
// Usage: node scripts/cap-unrealistic-leader-profit.mjs [--dry-run]
import { Client } from "pg";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

const dryRun = process.argv.includes("--dry-run");

function archetypeFactor(archetype) {
  switch (archetype) {
    case "flagship": return 0.6;
    case "stable": return 0.6;
    case "good_rr": return 0.8;
    case "high_risk": return 1.2;
    case "struggling": return 0.4;
    default: return 0.7;
  }
}

function withdrawalTargetRatio(archetype) {
  switch (archetype) {
    case "flagship": return 0.25 + Math.random() * 0.15;
    case "stable": return 0.20 + Math.random() * 0.15;
    case "good_rr": return 0.20 + Math.random() * 0.15;
    case "high_risk": return 0.08 + Math.random() * 0.17;
    case "struggling": return 0.05 + Math.random() * 0.10;
    default: return 0.20 + Math.random() * 0.15;
  }
}

const client = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

const { rows } = await client.query(`
  select id, coalesce(risk_archetype, 'balanced') as archetype, total_profit, total_withdrawals, account_capital,
    round(extract(epoch from (now() - created_at)) / 86400) as days_active
  from public.providers
  where total_profit > 0
`);
console.log(`${rows.length} profitable providers scanned`);

const updates = [];
const sample = [];
let cappedCount = 0;

for (const p of rows) {
  const totalProfit = Number(p.total_profit);
  const capital = Math.max(1, Number(p.account_capital ?? 0));
  const daysActive = Number(p.days_active ?? 0);
  const oldWithdrawals = Number(p.total_withdrawals);

  const tenureMultiple = Math.min(20, Math.max(1, daysActive / 60));
  const jitter = 0.7 + Math.random() * 0.6;
  const ceiling = capital * tenureMultiple * archetypeFactor(p.archetype) * jitter;

  if (totalProfit <= ceiling) continue; // already plausible, leave untouched

  const newProfit = Math.round(ceiling * 100) / 100;

  // Keep withdrawals consistent with the (now lower) profit -- re-apply
  // the same target-ratio logic fix-leader-withdrawal-ratios.mjs uses,
  // this time against newProfit, and never let withdrawals exceed it.
  const ratio = withdrawalTargetRatio(p.archetype);
  const newWithdrawals = Math.min(oldWithdrawals, Math.round(newProfit * ratio * 100) / 100);

  updates.push({ id: p.id, newProfit, newWithdrawals });
  cappedCount++;
  if (sample.length < 20) {
    sample.push(
      `${p.archetype} (${daysActive}d, capital=${capital.toFixed(2)}): profit ${totalProfit.toFixed(2)} -> ${newProfit.toFixed(2)}` +
      (newWithdrawals !== oldWithdrawals ? `, withdrawals ${oldWithdrawals.toFixed(2)} -> ${newWithdrawals.toFixed(2)}` : "")
    );
  }
}

console.log(`${cappedCount} leaders capped to a realistic profit ceiling`);
console.log(sample.join("\n"));

if (dryRun) {
  console.log("\n(dry run -- no writes made)");
  await client.end();
  process.exit(0);
}

const CHUNK = 500;
for (let i = 0; i < updates.length; i += CHUNK) {
  const chunk = updates.slice(i, i + CHUNK);
  await client.query(
    `update public.providers p set total_profit = v.profit, total_withdrawals = v.withdrawals
     from unnest($1::uuid[], $2::numeric[], $3::numeric[]) as v(id, profit, withdrawals)
     where p.id = v.id`,
    [chunk.map((u) => u.id), chunk.map((u) => u.newProfit), chunk.map((u) => u.newWithdrawals)],
  );
}
console.log("done.");
await client.end();
