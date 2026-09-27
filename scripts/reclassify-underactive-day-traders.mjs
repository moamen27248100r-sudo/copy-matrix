// A "moderate" (day trader) leader whose actual trade density can't
// support that label -- fewer than ~0.15 trades/day over a tenure of
// 100+ days (e.g. 42 trades over 844 days) -- doesn't read as a day
// trader at all; it reads as a swing/investor who happens to be tagged
// wrong. Per explicit customer direction: rather than manufacturing
// hundreds of thousands of filler trades to justify the "day trader"
// label (the exact mass-insert previously investigated and declined),
// reclassify these leaders as 'sporadic' (swing/investor) and rebuild
// their EXISTING trades -- same count, nothing added or removed -- to
// actually look like a swing investor's history:
//   - opened_at re-spaced 6-10 days apart (customer's own suggestion),
//     starting a few days after the leader's created_at
//   - exit_price redrawn to a 5-18% move (swing-sized), keeping each
//     trade's existing win/loss outcome and side exactly as it was --
//     only the magnitude changes
//   - closed_at recomputed to a 1-13.5-day hold from its new opened_at,
//     matching migration 0188's live sporadic bounds
//
// Deliberately NOT touched: entry_price's underlying market-price
// realism (still whatever it was), lot_size/commission/swap (unrelated
// to this ask), and providers.total_profit/account_capital -- those are
// running counters accumulated by run_market_simulation() over time,
// not a live derivation of the signals table (same precedent as this
// session's earlier outlier-clamp scripts); only the DERIVED
// provider_performance stats (win_rate_pct, avg_return_pct, etc.) are
// refreshed at the end, from the now-corrected signals table.
//
// Usage: node scripts/reclassify-underactive-day-traders.mjs [--dry-run]
import { Client } from "pg";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

const dryRun = process.argv.includes("--dry-run");
const DENSITY_THRESHOLD = 0.15; // trades/day, below which "day trader" isn't credible
const MIN_TENURE_DAYS = 100;
const SPACING_DAYS = [6, 10];
const HOLD_MINUTES = [1440, 19440]; // matches migration 0188's sporadic bounds
const MOVE_PCT = [0.05, 0.18];

const client = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

console.log("finding under-active 'moderate' leaders...");
const { rows: providers } = await client.query(`
  select id, display_name, created_at,
    extract(epoch from now() - created_at)/86400 as days
  from public.providers
  where coalesce(trading_style, 'moderate') = 'moderate'
    and extract(epoch from now() - created_at)/86400 >= ${MIN_TENURE_DAYS}
`);

const { rows: signalRows } = await client.query(`
  select s.id, s.provider_id, s.side, s.entry_price, s.exit_price
  from public.signals s
  where s.status = 'closed' and not s.created_by_admin
    and s.provider_id = any($1::uuid[])
  order by s.provider_id, s.opened_at asc
`, [providers.map((p) => p.id)]);

const signalsByProvider = new Map();
for (const s of signalRows) {
  let arr = signalsByProvider.get(s.provider_id);
  if (!arr) { arr = []; signalsByProvider.set(s.provider_id, arr); }
  arr.push(s);
}

const candidates = providers.filter((p) => {
  const n = (signalsByProvider.get(p.id) ?? []).length;
  return n > 0 && n / Math.max(1, p.days) < DENSITY_THRESHOLD;
});

console.log(`candidates: ${candidates.length}`);
let totalTrades = 0;
for (const p of candidates) totalTrades += signalsByProvider.get(p.id).length;
console.log(`total trades to rebuild: ${totalTrades}`);
console.log("sample:", candidates.slice(0, 5).map((p) => ({ name: p.display_name, days: Math.round(p.days), trades: signalsByProvider.get(p.id).length })));

if (dryRun) {
  console.log("\n(dry run -- no writes made)");
  await client.end();
  process.exit(0);
}

let providersDone = 0;
for (const p of candidates) {
  const trades = signalsByProvider.get(p.id);
  const ids = [];
  const newOpened = [];
  const newClosed = [];
  const newExit = [];

  let cursor = new Date(p.created_at).getTime() + (2 + Math.random() * 5) * 86400000;
  for (const t of trades) {
    const wasWin =
      (t.side === "buy" && Number(t.exit_price) > Number(t.entry_price)) ||
      (t.side === "sell" && Number(t.exit_price) < Number(t.entry_price));
    const pct = MOVE_PCT[0] + Math.random() * (MOVE_PCT[1] - MOVE_PCT[0]);
    const entry = Number(t.entry_price);
    const goesUp = (t.side === "buy" && wasWin) || (t.side === "sell" && !wasWin);
    const exit = Math.round(entry * (goesUp ? 1 + pct : 1 - pct) * 10000) / 10000;

    const openedAt = new Date(cursor);
    const holdMin = HOLD_MINUTES[0] + Math.random() * (HOLD_MINUTES[1] - HOLD_MINUTES[0]);
    const closedAt = new Date(cursor + holdMin * 60000);

    ids.push(t.id);
    newOpened.push(openedAt.toISOString());
    newClosed.push(closedAt.toISOString());
    newExit.push(exit);

    cursor += (SPACING_DAYS[0] + Math.random() * (SPACING_DAYS[1] - SPACING_DAYS[0])) * 86400000;
    if (cursor > Date.now()) cursor = Date.now() - Math.random() * 86400000; // keep remaining trades in the past
  }

  await client.query(
    `update public.signals s
     set opened_at = t.new_opened, closed_at = t.new_closed, exit_price = t.new_exit
     from unnest($1::uuid[], $2::timestamptz[], $3::timestamptz[], $4::numeric[]) as t(id, new_opened, new_closed, new_exit)
     where s.id = t.id`,
    [ids, newOpened, newClosed, newExit],
  );
  await client.query(`update public.providers set trading_style = 'sporadic' where id = $1`, [p.id]);

  providersDone++;
  process.stdout.write(`\rrebuilt: ${providersDone}/${candidates.length}`);
}

console.log("\nrefreshing provider_performance...");
await client.query(`select public.refresh_provider_performance()`);
console.log("Done.");

await client.end();
