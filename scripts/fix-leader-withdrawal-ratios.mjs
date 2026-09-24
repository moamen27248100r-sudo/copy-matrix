// One-time retroactive fix: customer reported a leader's profile could show
// $10,000+ total_profit against a near-zero total_withdrawals ($190 or
// less) -- unrealistic. The old live formula (v_withdrawal_bump) was pure
// independent-per-trade noise with no memory of the running total, so for
// a leader with few closed trades the realized ratio could land almost
// anywhere by chance.
//
// Sets every leader's total_withdrawals to a fresh draw from the same
// archetype-specific target-ratio distribution the retuned live formula
// now trends toward (see migration 0178), applied to their CURRENT
// total_profit. account_capital is reduced by the same delta so the
// numbers stay mutually coherent -- "this money was already taken out".
// Net-losing leaders (total_profit <= 0) get total_withdrawals reset to
// 0: can't withdraw profit that was never realized.
//
// QA found ~36% of profitable leaders have total_profit far above (5x+,
// up to a $5.37M outlier) their current account_capital -- a pure
// profit-ratio withdrawal would force ~40% of all profitable leaders down
// to an identical capital floor in one shot, itself an unrealistic,
// suspiciously repeated number. So the correction this script applies is
// capped at 50%-80% of each leader's CURRENT capital (random per leader,
// no shared floor value) -- extreme outliers get a meaningful but bounded
// withdrawal bump instead of the full mathematical target; the live
// model (0178) picks up the rest gradually from there, same 15%-of-
// capital-per-event cap.
//
// Usage: node scripts/fix-leader-withdrawal-ratios.mjs [--dry-run]
import { Client } from "pg";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

const dryRun = process.argv.includes("--dry-run");

function targetRatio(archetype) {
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
  select id, coalesce(risk_archetype, 'balanced') as archetype, total_profit, total_withdrawals, account_capital
  from public.providers
`);
console.log(`${rows.length} providers to reprice`);

const updates = [];
const sample = [];
let losingCount = 0;
for (const p of rows) {
  const totalProfit = Number(p.total_profit);
  const oldWithdrawals = Number(p.total_withdrawals);
  const oldCapital = Number(p.account_capital ?? 0);

  let newWithdrawals;
  let newCapital;
  if (totalProfit <= 0) {
    newWithdrawals = 0;
    newCapital = oldCapital;
    losingCount++;
  } else {
    const ratio = targetRatio(p.archetype);
    const target = totalProfit * ratio;
    const rawDelta = target - oldWithdrawals;
    if (rawDelta <= 0) {
      // Already at or above target (e.g. a prior run, or an already-large
      // withdrawal history) -- never reduce an existing amount.
      newWithdrawals = oldWithdrawals;
      newCapital = oldCapital;
    } else {
      const maxRemovable = oldCapital * (0.5 + Math.random() * 0.3);
      const delta = Math.min(rawDelta, maxRemovable);
      newWithdrawals = Math.round((oldWithdrawals + delta) * 100) / 100;
      newCapital = Math.max(50 + Math.random() * 150, Math.round((oldCapital - delta) * 100) / 100);
      newCapital = Math.round(newCapital * 100) / 100;
    }
  }

  updates.push({ id: p.id, newWithdrawals, newCapital });
  if (sample.length < 20) {
    sample.push(`${p.archetype}: profit=${totalProfit.toFixed(2)} withdrawals ${oldWithdrawals.toFixed(2)} -> ${newWithdrawals.toFixed(2)}, capital ${oldCapital.toFixed(2)} -> ${newCapital.toFixed(2)}`);
  }
}

console.log(`${losingCount} net-losing/break-even leaders reset to 0 withdrawals`);
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
    `update public.providers p set total_withdrawals = v.w, account_capital = v.c
     from unnest($1::uuid[], $2::numeric[], $3::numeric[]) as v(id, w, c)
     where p.id = v.id`,
    [chunk.map((u) => u.id), chunk.map((u) => u.newWithdrawals), chunk.map((u) => u.newCapital)],
  );
}
console.log("done.");
await client.end();
