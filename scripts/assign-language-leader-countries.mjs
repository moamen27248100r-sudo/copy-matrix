// One-time: give the platform a real leader for the two UI languages that
// currently have zero country-matched representation (Bengali/BD, Swahili/KE)
// by converting two existing bulk Arabic-pool leaders' identity (name,
// country, bio, symbol focus) -- same "identity swap on an existing leader
// with real trading history" approach already used this session for the
// duplicate-name fix, not a from-scratch leader (which would need fabricated
// history). Preserves all existing signals/stats/avatar untouched.
import { Client } from "pg";
import { config } from "dotenv";
config({ path: ".env.local" });

const client = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

const CONVERSIONS = [
  {
    id: "ef048519-61a8-4a92-9355-bd3ee2683160", // was: فادي الغامدي (OM)
    country: "BD",
    name: "Rafiq Ahmed",
    focus: "XAUUSD",
    bio: "متداول من بنغلاديش، متخصص في تداول الذهب انطلاقًا من الطلب الثقافي الكبير عليه في جنوب آسيا.",
  },
  {
    id: "b5e334a7-2787-4bfc-bc9d-54c55ca8f471", // was: عدنان البصري (IQ)
    country: "KE",
    name: "Brian Otieno",
    focus: "BTCUSDT",
    bio: "متداول كيني، يركّز على العملات الرقمية نظرًا لانتشار خدمات الدفع عبر الهاتف المحمول والعملات الرقمية بشكل كبير في بلده.",
  },
];

const dryRun = process.argv.includes("--dry-run");

for (const c of CONVERSIONS) {
  const { rows: before } = await client.query(
    `select id, display_name, country, bio, symbol_bias from public.providers where id = $1`,
    [c.id],
  );
  if (before.length === 0) throw new Error(`provider ${c.id} not found`);
  const prev = before[0];

  const newBias = [c.focus, ...prev.symbol_bias.filter((s) => s !== c.focus)];

  console.log(`${prev.display_name} (${prev.country}) -> ${c.name} (${c.country})`);

  if (!dryRun) {
    await client.query(
      `update public.providers set display_name = $1, country = $2, bio = $3, symbol_bias = $4 where id = $5`,
      [c.name, c.country, c.bio, newBias, c.id],
    );
  }
}

if (dryRun) {
  console.log("\n(dry run -- no writes made)");
} else {
  console.log("\nApplied. Refreshing provider_performance_mv...");
  await client.query(`select public.refresh_provider_performance()`);
  console.log("Done.");
}

await client.end();
