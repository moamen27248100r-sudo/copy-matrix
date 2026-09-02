// One-time: give every provider a real, varied account_capital instead
// of the flat $2000 notional every trade used uniformly. Ranges vary by
// risk_archetype so capital size itself reflects trading style — a
// "struggling" trader with a small account and a "flagship" trader
// with a large one both feel real, not just a coin flip.
//
// Computes everything in memory and applies it as one bulk UPDATE (not
// ~1924 sequential round-trips) — the first version held the connection
// open across thousands of small awaited queries and Supabase's direct
// connection dropped it partway through (twice) before finishing.
import { Client } from "pg";
import { config } from "dotenv";
config({ path: ".env.local" });

const RANGES = {
  flagship: [8000, 20000],
  stable: [500, 2000],
  balanced: [1000, 5000],
  good_rr: [2000, 8000],
  high_risk: [500, 15000],
  struggling: [300, 1500],
};
const FLAGSHIP_NAMES = new Set(["أنس ريان", "يوسف علي"]);

const client = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

const { rows: providers } = await client.query(`select id, display_name, risk_archetype from public.providers`);
console.log(`assigning capital to ${providers.length} providers`);

const updates = providers.map((p) => {
  const archetype = FLAGSHIP_NAMES.has(p.display_name) ? "flagship" : p.risk_archetype ?? "balanced";
  const [min, max] = RANGES[archetype] ?? RANGES.balanced;
  const capital = Math.round(min + Math.random() * (max - min));
  return { id: p.id, capital };
});

const CHUNK = 500;
for (let i = 0; i < updates.length; i += CHUNK) {
  const chunk = updates.slice(i, i + CHUNK);
  const values = chunk.map((_, j) => `($${j * 2 + 1}::uuid, $${j * 2 + 2}::numeric)`).join(",");
  const params = chunk.flatMap((u) => [u.id, u.capital]);
  await client.query(
    `update public.providers p set account_capital = v.capital from (values ${values}) as v(id, capital) where p.id = v.id`,
    params,
  );
  process.stdout.write(`\r${Math.min(i + CHUNK, updates.length)}/${updates.length}`);
}
console.log("\ndone");

const { rows: sample } = await client.query(
  `select risk_archetype, count(*), round(avg(account_capital)) as avg_capital, min(account_capital), max(account_capital)
   from public.providers group by risk_archetype order by risk_archetype`,
);
console.log(sample);

await client.end();
