// One-time assignment of a persistent trading-style personality per
// provider (scalper / session_trader / moderate / sporadic), tier-
// conditioned on the existing activity_weight for narrative coherence.
// Also rewrites session_start_hour/session_end_hour so only
// session_trader providers keep a window (everyone else is cleared,
// since a leftover legacy window would otherwise wrongly gate their
// new style under the style-driven session gate in
// run_market_simulation()). Bulk UPDATE ... FROM (VALUES ...) in
// chunks — same pattern as assign-provider-activity-profile.mjs,
// avoids the connection drop that ~1900 sequential awaited queries
// caused earlier.
//
// Usage: node scripts/assign-provider-trading-style.mjs [--dry-run]
import { Client } from "pg";
import { config } from "dotenv";
config({ path: ".env.local" });

const dryRun = process.argv.includes("--dry-run");

const FLAGSHIP_NAMES = new Set(["أنس ريان", "يوسف علي"]);

const SESSION_WINDOWS = [
  [0, 8], // Asian session
  [7, 16], // London session
  [12, 21], // New York session
  [18, 2], // evening/night trader (wraps past midnight)
  [9, 13], // short morning-only trader
];

function pickStyle(activityWeight) {
  const tier = activityWeight > 1.6 ? "power" : activityWeight < 0.6 ? "quiet" : "normal";
  const roll = Math.random();
  if (tier === "power") {
    if (roll < 0.55) return "scalper";
    if (roll < 0.90) return "moderate";
    if (roll < 0.98) return "session_trader";
    return "sporadic";
  }
  if (tier === "quiet") {
    if (roll < 0.55) return "sporadic";
    if (roll < 0.80) return "session_trader";
    if (roll < 0.98) return "moderate";
    return "scalper";
  }
  // normal
  if (roll < 0.55) return "moderate";
  if (roll < 0.75) return "session_trader";
  if (roll < 0.85) return "scalper";
  return "sporadic";
}

function pickSessionWindow() {
  const [start, end] = SESSION_WINDOWS[Math.floor(Math.random() * SESSION_WINDOWS.length)];
  return { start, end };
}

const db = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await db.connect();

const { rows: providers } = await db.query(`select id, display_name, coalesce(activity_weight, 1) as activity_weight from public.providers`);
console.log(`assigning trading styles for ${providers.length} providers`);

const updates = providers.map((p) => {
  let style = pickStyle(Number(p.activity_weight));
  let start = null;
  let end = null;

  if (FLAGSHIP_NAMES.has(p.display_name)) {
    style = "session_trader";
  }

  if (style === "session_trader") {
    ({ start, end } = pickSessionWindow());
  }

  return { id: p.id, displayName: p.display_name, style, start, end };
});

if (dryRun) {
  console.log("DRY RUN sample:", updates.slice(0, 8));
  const counts = updates.reduce((acc, u) => {
    acc[u.style] = (acc[u.style] || 0) + 1;
    return acc;
  }, {});
  console.log("counts:", counts);
  console.log(
    "pct:",
    Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, `${((v / updates.length) * 100).toFixed(1)}%`])),
  );
  const flagships = updates.filter((u) => FLAGSHIP_NAMES.has(u.displayName));
  console.log("flagship pair:", flagships);
  await db.end();
  process.exit(0);
}

const CHUNK = 500;
for (let i = 0; i < updates.length; i += CHUNK) {
  const chunk = updates.slice(i, i + CHUNK);
  const values = chunk
    .map((_, j) => `($${j * 4 + 1}::uuid, $${j * 4 + 2}::text, $${j * 4 + 3}::smallint, $${j * 4 + 4}::smallint)`)
    .join(",");
  const params = chunk.flatMap((u) => [u.id, u.style, u.start, u.end]);
  await db.query(
    `update public.providers p set trading_style = v.trading_style, session_start_hour = v.session_start_hour, session_end_hour = v.session_end_hour
     from (values ${values}) as v(id, trading_style, session_start_hour, session_end_hour)
     where p.id = v.id`,
    params,
  );
  process.stdout.write(`\rupdated ${Math.min(i + CHUNK, updates.length)}/${updates.length}`);
}
console.log("\ndone");
await db.end();
