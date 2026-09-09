// One-time: retroactively give the CURRENT high_risk population a
// consistent margin-call history — some already blown-and-recovered,
// some already blown-and-stopped, most untouched — so future live
// margin calls in run_market_simulation() (0103) aren't necessarily a
// leader's first. Mirrors 0055's one-off cosmetic-trade pattern, but
// now also writes the persistent trading_status/margin_called_at/
// margin_call_count columns and flags the planted trade with
// signals.is_margin_call = true instead of leaving it unflagged.
//
// Usage: node scripts/backfill-high-risk-margin-history.mjs [--dry-run]
import { Client } from "pg";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

const dryRun = process.argv.includes("--dry-run");
const HIGH_RISK_RANGE = [500, 15000]; // must match RANGES.high_risk in assign-provider-capital.mjs

const db = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await db.connect();

const { rows: leaders } = await db.query(
  `select id, display_name, account_capital from public.providers where risk_archetype = 'high_risk'`,
);
console.log(`${leaders.length} high_risk leaders`);

// ~35% of high_risk leaders get a retroactive margin-call history,
// matching the proportion 0055 originally planted as a cosmetic one-off.
const [min, max] = HIGH_RISK_RANGE;
const updates = leaders
  .filter(() => Math.random() < 0.35)
  .map((p) => {
    const recovered = Math.random() < 0.70; // matches the live mechanic's 1st-occurrence recover odds
    return {
      id: p.id,
      displayName: p.display_name,
      status: recovered ? "active" : "stopped",
      capital: recovered
        ? Math.round(min + Math.random() * (max - min))
        : Math.round(Number(p.account_capital ?? min) * (0.01 + Math.random() * 0.04) * 100) / 100,
      calledAt: new Date(Date.now() - Math.floor(Math.random() * 180) * 86400000).toISOString(),
    };
  });

if (dryRun) {
  console.log("DRY RUN sample:", updates.slice(0, 8));
  console.log(
    `active-after-recover: ${updates.filter((u) => u.status === "active").length}, stopped: ${updates.filter((u) => u.status === "stopped").length}, untouched: ${leaders.length - updates.length}`,
  );
  await db.end();
  process.exit(0);
}

const CHUNK = 500;
for (let i = 0; i < updates.length; i += CHUNK) {
  const chunk = updates.slice(i, i + CHUNK);
  const values = chunk
    .map((_, j) => `($${j * 4 + 1}::uuid, $${j * 4 + 2}::text, $${j * 4 + 3}::numeric, $${j * 4 + 4}::timestamptz)`)
    .join(",");
  const params = chunk.flatMap((u) => [u.id, u.status, u.capital, u.calledAt]);
  await db.query(
    `update public.providers p
     set trading_status = v.status, account_capital = v.capital, margin_called_at = v.called_at, margin_call_count = 1
     from (values ${values}) as v(id, status, capital, called_at)
     where p.id = v.id`,
    params,
  );

  // Plant one flagged historical margin-call trade per affected leader
  // by repurposing an existing closed trade (every leader already has
  // several) — cheaper and simpler than inserting a brand-new row.
  const pickIds = chunk.map((u) => u.id);
  await db.query(
    `update public.signals s
     set exit_price = round((
           case when s.side = 'buy' then s.entry_price * (1 - (0.20 + random() * 0.20))
                else s.entry_price * (1 + (0.20 + random() * 0.20))
           end
         )::numeric, 4),
         is_margin_call = true
     from (
       select distinct on (provider_id) id, provider_id
       from public.signals
       where provider_id = any($1::uuid[]) and status = 'closed'
       order by provider_id, random()
     ) picks
     where s.id = picks.id`,
    [pickIds],
  );
  process.stdout.write(`\rupdated ${Math.min(i + CHUNK, updates.length)}/${updates.length}`);
}
console.log("\ndone");
await db.end();
