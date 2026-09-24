// assign-leader-countries.mjs picked a fully random Arab country for every
// local (Arabic-named) leader, independent of the name itself -- producing
// unrealistic pairs like "يزن القحطاني" (a Saudi/Gulf tribal surname) tagged
// as Egypt. This reassigns country only for leaders whose LAST NAME is a
// real-world regionally-marked surname (Gulf/Iraqi tribal names, city-nisbas
// like "التكريتي", Levant/Egypt Ottoman-era urban surnames), picking among
// the countries that surname is actually plausible in. Generic pan-Arab
// names (Ali, Mahmoud, Hussein, Saleh, Rashid, ...) are left untouched --
// a person with one of those names really could be from any Arab country,
// so their existing random assignment is already realistic.
import { Client } from "pg";
import { config } from "dotenv";
config({ path: ".env.local" });

const dryRun = process.argv.includes("--dry-run");

// Tight, regionally-marked surnames -> plausible country pool.
const SURNAME_COUNTRIES = {
  // Iraqi city-nisbas / tribes
  "البصري": ["IQ"],
  "التكريتي": ["IQ"],
  "الجبوري": ["IQ", "SY", "JO"],
  "الديواني": ["IQ", "SA", "KW"],
  "السامرائي": ["IQ"],
  "الكربلائي": ["IQ"],
  "الموصلي": ["IQ"],
  "النجفي": ["IQ"],

  // Saudi / Gulf tribal
  "البلوشي": ["OM", "AE", "SA"],
  "البلوي": ["SA", "JO", "EG"],
  "الجابر": ["KW", "SA", "AE", "QA", "BH"],
  "الجاسم": ["KW", "QA", "BH", "IQ", "SA"],
  "الحربي": ["SA", "JO"],
  "الحمداني": ["YE", "IQ", "SA"],
  "الدوسري": ["SA", "BH", "KW", "QA"],
  "الزعابي": ["AE", "QA", "BH"],
  "الزهراني": ["SA"],
  "السويدي": ["AE", "QA", "BH", "SA"],
  "الشمري": ["SA", "IQ", "KW", "JO"],
  "العتيبي": ["SA", "JO"],
  "العجمي": ["KW", "BH", "SA", "AE"],
  "العنزي": ["SA", "JO", "KW", "IQ"],
  "الغامدي": ["SA"],
  "القحطاني": ["SA", "YE"],
  "الكعبي": ["AE", "QA", "BH", "IQ"],
  "الكندري": ["KW"],
  "المري": ["QA", "AE", "SA"],
  "المطيري": ["SA", "KW", "JO"],
  "المهيري": ["AE"],
  "النعيمي": ["AE", "QA", "OM"],

  // Broader but still meaningfully regional
  "الحسيني": ["PS", "JO", "IQ", "LB", "SY", "EG"],
  "الرفاعي": ["IQ", "EG", "SY", "LB", "JO"],
  "كنعان": ["LB", "SY", "PS", "JO"],

  // Egypt / Levant Ottoman-era urban surnames
  "الشافعي": ["EG", "YE", "JO", "SY"],
  "فهمي": ["EG", "SY", "LB"],
  "فاروق": ["EG", "SY", "LB"],
  "رمزي": ["EG", "SY", "LB", "JO"],
  "توفيق": ["EG", "SY", "LB", "JO"],
  "درويش": ["EG", "SY", "LB", "JO"],
  "شاهين": ["EG", "SY", "LB", "JO"],
  "صبري": ["EG", "SY", "JO"],
  "حداد": ["LB", "SY", "JO", "PS", "EG"],
  "بركات": ["LB", "SY", "JO", "EG", "PS"],
  "غانم": ["KW", "EG", "LB", "SY"],
  "السيد": ["EG", "SD", "PS"],
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const client = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

const { rows: providers } = await client.query(
  `select id, display_name, country from public.providers where display_name ~ '[؀-ۿ]'`,
);

const updates = [];
const sample = [];
for (const p of providers) {
  const parts = p.display_name.trim().split(/\s+/);
  const lastName = parts[parts.length - 1];
  const pool = SURNAME_COUNTRIES[lastName];
  if (!pool || pool.includes(p.country)) continue; // no rule, or already plausible
  const newCountry = pick(pool);
  updates.push([p.id, newCountry]);
  if (sample.length < 25) sample.push(`${p.display_name}: ${p.country} -> ${newCountry}`);
}

console.log(`${providers.length} Arabic-named leaders scanned, ${updates.length} reassigned to a plausible country`);
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
    `update public.providers p set country = v.country from (select unnest($1::uuid[]) as id, unnest($2::text[]) as country) v where p.id = v.id`,
    [chunk.map((c) => c[0]), chunk.map((c) => c[1])],
  );
}
console.log("leader countries corrected");

// Keep synthetic_customers.country consistent with the corrected leader
// countries, same 90% leader-country / 10% random-other split already used
// when they were first seeded (assign-leader-countries.mjs).
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

const { rows: allProviderCountries } = await client.query(`select id, country from public.providers`);
const countryByProvider = new Map(allProviderCountries.map((p) => [p.id, p.country]));

const { rows: customers } = await client.query(`select id, provider_id from public.synthetic_customers`);
console.log(`recomputing country for ${customers.length} synthetic customers`);
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
console.log("customer countries recomputed");

await client.end();
