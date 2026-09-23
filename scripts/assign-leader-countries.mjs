// Geographic localization: gives every provider and every synthetic customer
// a country. The existing 50-leader curated international roster (already
// has providers.country set) is left untouched. Every other (Arabic-named)
// leader gets a random Arab country, weighted toward the larger
// Arabic-speaking markets. Every synthetic customer gets their leader's
// country ~90% of the time, else a random OTHER country from the full pool
// (mirrors the existing 90/10 name-pool split already used when seeding
// customers).
import { Client } from "pg";
import { config } from "dotenv";
config({ path: ".env.local" });

const dryRun = process.argv.includes("--dry-run");

// Weighted toward population/market size; every Arab country still gets a
// real (if smaller) share for genuine diversity.
const ARAB_COUNTRIES = [
  ...Array(6).fill("EG"), ...Array(6).fill("SA"), ...Array(4).fill("AE"),
  ...Array(3).fill("IQ"), ...Array(3).fill("MA"), ...Array(2).fill("DZ"),
  ...Array(2).fill("KW"), ...Array(2).fill("JO"), ...Array(2).fill("TN"),
  ...Array(2).fill("SY"), ...Array(2).fill("YE"), ...Array(2).fill("SD"),
  "QA", "BH", "OM", "LB", "LY", "PS", "MR", "SO",
];

const ALL_COUNTRIES = [
  ...ARAB_COUNTRIES,
  "US", "GB", "DE", "FR", "TR", "IN", "BR", "JP", "CA", "AU",
  "ES", "IT", "NL", "SE", "MX", "ID", "PK", "RU", "CN", "PH",
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const client = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

const { rows: providers } = await client.query(`select id, country from public.providers`);
const toAssign = providers.filter((p) => p.country == null);
console.log(`${providers.length} providers, ${toAssign.length} without a country to assign`);

if (!dryRun) {
  const CHUNK = 500;
  for (let i = 0; i < toAssign.length; i += CHUNK) {
    const chunk = toAssign.slice(i, i + CHUNK);
    const ids = chunk.map((p) => p.id);
    const countries = chunk.map(() => pick(ARAB_COUNTRIES));
    await client.query(
      `update public.providers p set country = v.country from (select unnest($1::uuid[]) as id, unnest($2::text[]) as country) v where p.id = v.id`,
      [ids, countries],
    );
  }
  console.log("leader countries assigned");
}

const { rows: providerCountries } = await client.query(`select id, country from public.providers`);
const countryByProvider = new Map(providerCountries.map((p) => [p.id, p.country]));

const { rows: customers } = await client.query(`select id, provider_id from public.synthetic_customers`);
console.log(`${customers.length} synthetic customers to assign a country`);

if (!dryRun) {
  const CHUNK = 500;
  for (let i = 0; i < customers.length; i += CHUNK) {
    const chunk = customers.slice(i, i + CHUNK);
    const ids = chunk.map((c) => c.id);
    const countries = chunk.map((c) => {
      const leaderCountry = countryByProvider.get(c.provider_id);
      return Math.random() < 0.9 && leaderCountry ? leaderCountry : pick(ALL_COUNTRIES);
    });
    await client.query(
      `update public.synthetic_customers sc set country = v.country from (select unnest($1::uuid[]) as id, unnest($2::text[]) as country) v where sc.id = v.id`,
      [ids, countries],
    );
  }
  console.log("customer countries assigned");
}

await client.end();
