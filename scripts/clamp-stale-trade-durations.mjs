// Retroactively fixes closed trades whose (closed_at - opened_at)
// duration is implausible for their leader's trading_style, in both
// directions:
//   - TOO LONG (any close_trigger): found via investigation that a
//     processing backlog let ~13% of the platform's closed trades sit
//     open far longer than their style should ever allow (up to 181
//     days for a *scalper*).
//   - TOO SHORT, but ONLY when close_trigger = 'timeout': a tp/sl/
//     breakeven/margin_call close is a real, legitimate early exit (the
//     market can hit a stop or target within hours even for a swing
//     position) and is deliberately left alone. A 'timeout' close is
//     the one path whose duration is supposed to be governed purely by
//     the style-aware random interval -- these are ones generated
//     before migration 0188_archetype_matched_trade_execution.sql
//     tightened that interval, so they still reflect the old, looser
//     shared bucket.
// Only closed_at is recomputed, to a random duration within the same
// style-aware bounds migration 0188 now enforces live -- entry_price,
// exit_price, side, pnl and every other financial field are left
// exactly as they are. session_trader and high_risk are left alone
// (their own distinct models, not flagged as stale by this check).
//
// Usage: node scripts/clamp-stale-trade-durations.mjs [--dry-run]
import { Client } from "pg";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

const dryRun = process.argv.includes("--dry-run");

// [min minutes, max minutes], matching migration 0188's live bounds.
const BOUNDS_MIN = {
  scalper: [2, 27],
  moderate: [30, 450],
  sporadic: [1440, 19440],
};
const CAP_HOURS = { scalper: 24, moderate: 72, sporadic: 720 };

const client = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

console.log("finding stale-duration closed trades...");
const { rows } = await client.query(`
  select s.id, s.opened_at, coalesce(p.trading_style, 'moderate') as trading_style
  from public.signals s
  join public.providers p on p.id = s.provider_id
  where s.status = 'closed' and not s.created_by_admin and s.closed_at is not null
    and coalesce(p.trading_style, 'moderate') in ('scalper', 'moderate', 'sporadic')
    and (
      extract(epoch from (s.closed_at - s.opened_at)) / 3600 > case coalesce(p.trading_style, 'moderate')
        when 'scalper' then ${CAP_HOURS.scalper}
        when 'moderate' then ${CAP_HOURS.moderate}
        when 'sporadic' then ${CAP_HOURS.sporadic}
      end
      or (
        s.close_trigger = 'timeout'
        and extract(epoch from (s.closed_at - s.opened_at)) / 60 < case coalesce(p.trading_style, 'moderate')
          when 'scalper' then ${BOUNDS_MIN.scalper[0]}
          when 'moderate' then ${BOUNDS_MIN.moderate[0]}
          when 'sporadic' then ${BOUNDS_MIN.sporadic[0]}
        end
      )
    )
`);
console.log(`found ${rows.length} stale trades`);

const byStyle = {};
for (const r of rows) byStyle[r.trading_style] = (byStyle[r.trading_style] ?? 0) + 1;
console.log("by style:", byStyle);

if (dryRun) {
  console.log("\n(dry run -- no writes made)");
  await client.end();
  process.exit(0);
}

const CHUNK = 500;
let updated = 0;
for (let i = 0; i < rows.length; i += CHUNK) {
  const chunk = rows.slice(i, i + CHUNK);
  const ids = [];
  const newClosedAts = [];
  for (const r of chunk) {
    const [lo, hi] = BOUNDS_MIN[r.trading_style];
    const minutes = Math.round(lo + Math.random() * (hi - lo));
    ids.push(r.id);
    newClosedAts.push(new Date(new Date(r.opened_at).getTime() + minutes * 60000).toISOString());
  }
  await client.query(
    `update public.signals s
     set closed_at = t.new_closed_at
     from unnest($1::uuid[], $2::timestamptz[]) as t(id, new_closed_at)
     where s.id = t.id`,
    [ids, newClosedAts],
  );
  updated += chunk.length;
  process.stdout.write(`\rupdated: ${updated}/${rows.length}`);
}
console.log("\nrefreshing provider_performance...");
await client.query(`select public.refresh_provider_performance()`);
console.log("Done.");

await client.end();
