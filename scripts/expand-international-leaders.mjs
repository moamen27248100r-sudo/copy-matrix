// Converts a random sample of existing Arabic-named leaders (identity
// swap: display_name/country/bio only, same id, same trading history --
// same safe pattern as assign-language-leader-countries.mjs) into
// non-Arab identities, to raise the platform's non-Arab leader share
// toward a target ratio (explicit customer request: 60%).
//
// Bios: reused from the existing pool of GENERIC (non-nationality-
// specific) bio texts already shared by hundreds of leaders platform-
// wide -- fetched live from the DB (bios used by >3 leaders), never
// hardcoded, so there's zero risk of a hand-transcribed Arabic typo and
// zero new translation work needed (these bios are already in the Bios
// namespace across all 13 locales).
//
// Names: reused from the same per-country pools already built for
// synthetic customers (scripts/backfill-synthetic-customers.mjs).
//
// Usage: node scripts/expand-international-leaders.mjs [--dry-run] [--target=0.6]
import { Client } from "pg";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

const dryRun = process.argv.includes("--dry-run");
const targetArg = process.argv.find((a) => a.startsWith("--target="));
const TARGET_RATIO = targetArg ? Number(targetArg.split("=")[1]) : 0.6;

// Same 42-country pool as backfill-synthetic-customers.mjs, each with a
// rough weight toward larger/more prominent trading markets.
const INTL_NAME_POOLS = {
  DE: { w: 6, first: ["Lukas", "Anna", "Max", "Lena"], last: ["Müller", "Schmidt", "Weber", "Becker"] },
  FR: { w: 6, first: ["Louis", "Emma", "Hugo", "Camille"], last: ["Martin", "Bernard", "Dubois", "Girard"] },
  IT: { w: 5, first: ["Marco", "Giulia", "Luca", "Chiara"], last: ["Rossi", "Russo", "Ferrari", "Esposito"] },
  ES: { w: 5, first: ["Pablo", "Lucía", "Alejandro", "María"], last: ["García", "Martínez", "López", "Sánchez"] },
  PT: { w: 2, first: ["João", "Beatriz", "Tiago", "Ana"], last: ["Silva", "Santos", "Ferreira", "Pereira"] },
  NL: { w: 3, first: ["Daan", "Sanne", "Sem", "Eva"], last: ["de Jong", "Jansen", "de Vries", "Bakker"] },
  BE: { w: 2, first: ["Lucas", "Marie", "Louis", "Emma"], last: ["Peeters", "Janssens", "Maes", "Jacobs"] },
  AT: { w: 2, first: ["Jonas", "Anna", "Felix", "Lena"], last: ["Gruber", "Huber", "Bauer", "Wagner"] },
  IE: { w: 2, first: ["Sean", "Aoife", "Liam", "Niamh"], last: ["Byrne", "Murphy", "Kelly", "Walsh"] },
  GR: { w: 1, first: ["Nikos", "Eleni", "Giorgos", "Maria"], last: ["Papadopoulos", "Georgiou", "Ioannou", "Nikolaou"] },
  NO: { w: 1, first: ["Magnus", "Ingrid", "Erik", "Emma"], last: ["Haugen", "Olsen", "Hansen", "Andersen"] },
  DK: { w: 1, first: ["Mikkel", "Freja", "Oliver", "Ida"], last: ["Nielsen", "Jensen", "Andersen", "Christensen"] },
  FI: { w: 1, first: ["Elias", "Aino", "Väinö", "Emilia"], last: ["Korhonen", "Virtanen", "Mäkinen", "Nieminen"] },
  RU: { w: 3, first: ["Dmitri", "Anastasia", "Ivan", "Olga"], last: ["Volkov", "Ivanov", "Petrov", "Sokolova"] },
  PL: { w: 3, first: ["Jakub", "Zofia", "Piotr", "Anna"], last: ["Kowalski", "Nowak", "Wiśniewski", "Wójcik"] },
  CZ: { w: 1, first: ["Jakub", "Tereza", "Jan", "Eliška"], last: ["Novák", "Svoboda", "Dvořák", "Procházka"] },
  HU: { w: 1, first: ["Bence", "Zsófia", "Levente", "Anna"], last: ["Szabó", "Nagy", "Kovács", "Tóth"] },
  RO: { w: 1, first: ["Andrei", "Ioana", "Alexandru", "Maria"], last: ["Popescu", "Ionescu", "Popa", "Dumitru"] },
  US: { w: 8, first: ["Michael", "Emily", "James", "Jessica"], last: ["Johnson", "Williams", "Brown", "Davis"] },
  MX: { w: 4, first: ["Diego", "Valentina", "Santiago", "Camila"], last: ["Hernández", "García", "Martínez", "López"] },
  BR: { w: 5, first: ["Lucas", "Beatriz", "Gabriel", "Larissa"], last: ["Silva", "Souza", "Oliveira", "Pereira"] },
  AR: { w: 2, first: ["Mateo", "Valentina", "Franco", "Martina"], last: ["Rojas", "Fernández", "González", "Díaz"] },
  CO: { w: 2, first: ["Santiago", "Mariana", "Juan", "Valeria"], last: ["Gómez", "Rodríguez", "Martínez", "López"] },
  CL: { w: 1, first: ["Sebastián", "Fernanda", "Matías", "Camila"], last: ["Muñoz", "Contreras", "Rojas", "Vargas"] },
  CN: { w: 6, first: ["Wei", "Mei", "Jun", "Xin"], last: ["Zhang", "Wang", "Li", "Chen"] },
  KR: { w: 4, first: ["Ji-woo", "Min-jun", "Seo-yeon", "Joon"], last: ["Kim", "Park", "Lee", "Choi"] },
  IN: { w: 5, first: ["Arjun", "Ananya", "Rohan", "Priya"], last: ["Sharma", "Patel", "Gupta", "Kumar"] },
  PK: { w: 2, first: ["Ahmed", "Ayesha", "Bilal", "Sana"], last: ["Khan", "Malik", "Ahmed", "Raza"] },
  BD: { w: 1, first: ["Rafiq", "Nusrat", "Karim", "Farhana"], last: ["Ahmed", "Rahman", "Islam", "Hossain"] },
  ID: { w: 3, first: ["Bayu", "Putri", "Adi", "Dewi"], last: ["Pratama", "Santoso", "Wijaya", "Kusuma"] },
  TH: { w: 2, first: ["Somchai", "Siriporn", "Anong", "Krit"], last: ["Charoen", "Suwan", "Boonmee", "Saetang"] },
  VN: { w: 2, first: ["Minh", "Linh", "Nam", "Huong"], last: ["Nguyen", "Tran", "Le", "Pham"] },
  PH: { w: 2, first: ["Miguel", "Andrea", "Josef", "Angela"], last: ["Santos", "Reyes", "Cruz", "Garcia"] },
  MY: { w: 1, first: ["Nur", "Aisyah", "Danish", "Farah"], last: ["Ismail", "Rahman", "Yusof", "Hassan"] },
  SG: { w: 1, first: ["Wei Jie", "Michelle", "Kai", "Hui Ling"], last: ["Tan", "Lim", "Lee", "Ng"] },
  IL: { w: 2, first: ["Noa", "David", "Maya", "Omer"], last: ["Cohen", "Levi", "Mizrahi", "Peretz"] },
  TR: { w: 3, first: ["Emre", "Elif", "Mehmet", "Zeynep"], last: ["Yılmaz", "Kaya", "Demir", "Şahin"] },
  ZA: { w: 2, first: ["Sipho", "Thandi", "Johan", "Lerato"], last: ["Nkosi", "Dlamini", "van der Merwe", "Botha"] },
  KE: { w: 1, first: ["Brian", "Amina", "Kevin", "Wanjiru"], last: ["Otieno", "Kamau", "Wanjiru", "Mwangi"] },
  GH: { w: 1, first: ["Kwame", "Ama", "Kofi", "Akosua"], last: ["Mensah", "Owusu", "Asante", "Boateng"] },
  AU: { w: 3, first: ["Jack", "Chloe", "William", "Olivia"], last: ["Anderson", "Wilson", "Taylor", "Thompson"] },
  NZ: { w: 1, first: ["Liam", "Charlotte", "Jack", "Emily"], last: ["Reid", "Anderson", "Taylor", "Wilson"] },
};

const COUNTRY_POOL = Object.entries(INTL_NAME_POOLS).flatMap(([code, v]) => Array(v.w).fill(code));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const client = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

const { rows: genericBioRows } = await client.query(
  `select bio from public.providers where bio is not null group by bio having count(*) > 3`,
);
const GENERIC_BIOS = genericBioRows.map((r) => r.bio);
console.log(`${GENERIC_BIOS.length} generic bios available for reuse`);

const { rows: totalRows } = await client.query(`select count(*)::int as n from public.providers`);
const total = totalRows[0].n;
const { rows: nonArabRows } = await client.query(
  `select count(*)::int as n from public.providers where display_name !~ '[؀-ۿ]'`,
);
const currentNonArab = nonArabRows[0].n;
const targetNonArab = Math.round(total * TARGET_RATIO);
const needed = Math.max(0, targetNonArab - currentNonArab);

console.log(`total providers: ${total}, currently non-Arab-named: ${currentNonArab}, target: ${targetNonArab} (${(TARGET_RATIO * 100).toFixed(0)}%), converting: ${needed}`);

const { rows: eligible } = await client.query(
  `select id from public.providers where display_name ~ '[؀-ۿ]' and user_id is null order by random() limit $1`,
  [needed],
);
console.log(`${eligible.length} eligible leaders selected for conversion`);

const updates = eligible.map((r) => {
  const country = pick(COUNTRY_POOL);
  const pool = INTL_NAME_POOLS[country];
  const name = `${pick(pool.first)} ${pick(pool.last)}`;
  const bio = pick(GENERIC_BIOS);
  return { id: r.id, name, country, bio };
});

console.log("\nSample:");
for (const u of updates.slice(0, 15)) console.log(`${u.name} (${u.country}) -- ${u.bio}`);

const byCountry = {};
for (const u of updates) byCountry[u.country] = (byCountry[u.country] || 0) + 1;
console.log("\nDistribution by country:", byCountry);

if (dryRun) {
  console.log("\n(dry run -- no writes made)");
  await client.end();
  process.exit(0);
}

const CHUNK = 500;
for (let i = 0; i < updates.length; i += CHUNK) {
  const chunk = updates.slice(i, i + CHUNK);
  await client.query(
    `update public.providers p set display_name = v.name, country = v.country, bio = v.bio
     from unnest($1::uuid[], $2::text[], $3::text[], $4::text[]) as v(id, name, country, bio)
     where p.id = v.id`,
    [chunk.map((u) => u.id), chunk.map((u) => u.name), chunk.map((u) => u.country), chunk.map((u) => u.bio)],
  );
  process.stdout.write(`\rupdated: ${Math.min(i + CHUNK, updates.length)}/${updates.length}`);
}
console.log("\ndone. Refreshing provider_performance_mv...");
await client.query(`select public.refresh_provider_performance()`);
console.log("Done.");

await client.end();
