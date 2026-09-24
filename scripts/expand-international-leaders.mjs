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
// Expanded (from an original 4x4-per-country pool) after QA found ~410
// leaders sharing a duplicate display_name -- birthday-paradox collisions
// were near-guaranteed with only 16 combos for weight-8 countries like US.
// Each country now carries 10-16 first/last names (real, common ones,
// scaled roughly to population/weight) for far more headroom, and every
// caller additionally enforces exact uniqueness against existing names
// (see pickUniqueName below) so a repeat is now structurally impossible,
// not just less likely.
const INTL_NAME_POOLS = {
  DE: { w: 6, first: ["Lukas", "Anna", "Max", "Lena", "Paul", "Laura", "Jonas", "Julia", "Finn", "Sophie", "Tim", "Hannah"], last: ["Müller", "Schmidt", "Weber", "Becker", "Schneider", "Hoffmann", "Koch", "Richter", "Klein", "Wolf", "Schäfer", "Zimmermann"] },
  FR: { w: 6, first: ["Louis", "Emma", "Hugo", "Camille", "Léo", "Chloé", "Nathan", "Manon", "Théo", "Léa", "Antoine", "Julie"], last: ["Martin", "Bernard", "Dubois", "Girard", "Thomas", "Robert", "Petit", "Durand", "Moreau", "Lefebvre", "Roux", "Fournier"] },
  IT: { w: 5, first: ["Marco", "Giulia", "Luca", "Chiara", "Alessandro", "Francesca", "Matteo", "Sara", "Andrea", "Elena", "Davide", "Valentina"], last: ["Rossi", "Russo", "Ferrari", "Esposito", "Bianchi", "Romano", "Colombo", "Ricci", "Marino", "Greco", "Bruno", "Gallo"] },
  ES: { w: 5, first: ["Pablo", "Lucía", "Alejandro", "María", "Carlos", "Carmen", "Javier", "Elena", "Daniel", "Marta", "Sergio", "Laura"], last: ["García", "Martínez", "López", "Sánchez", "González", "Pérez", "Rodríguez", "Fernández", "Gómez", "Ruiz", "Díaz", "Moreno"] },
  PT: { w: 2, first: ["João", "Beatriz", "Tiago", "Ana", "Miguel", "Inês", "Rui", "Catarina", "Bruno", "Sofia"], last: ["Silva", "Santos", "Ferreira", "Pereira", "Costa", "Rodrigues", "Carvalho", "Gomes", "Martins", "Ribeiro"] },
  NL: { w: 3, first: ["Daan", "Sanne", "Sem", "Eva", "Lars", "Fleur", "Bram", "Iris", "Thijs", "Anne"], last: ["de Jong", "Jansen", "de Vries", "Bakker", "Visser", "Smit", "Meijer", "de Boer", "Mulder", "Dekker"] },
  BE: { w: 2, first: ["Lucas", "Marie", "Louis", "Emma", "Arthur", "Julie", "Noah", "Charlotte", "Victor", "Léa"], last: ["Peeters", "Janssens", "Maes", "Jacobs", "Mertens", "Willems", "Claes", "Goossens", "Wouters", "De Smet"] },
  AT: { w: 2, first: ["Jonas", "Anna", "Felix", "Lena", "David", "Laura", "Simon", "Julia", "Paul", "Sophie"], last: ["Gruber", "Huber", "Bauer", "Wagner", "Pichler", "Steiner", "Moser", "Berger", "Fuchs", "Winkler"] },
  IE: { w: 2, first: ["Sean", "Aoife", "Liam", "Niamh", "Conor", "Ciara", "Cian", "Saoirse", "Darragh", "Róisín"], last: ["Byrne", "Murphy", "Kelly", "Walsh", "O'Brien", "Ryan", "O'Connor", "Doyle", "McCarthy", "Gallagher"] },
  GR: { w: 1, first: ["Nikos", "Eleni", "Giorgos", "Maria", "Dimitris", "Sofia", "Kostas", "Katerina", "Yannis", "Anna"], last: ["Papadopoulos", "Georgiou", "Ioannou", "Nikolaou", "Papadakis", "Vasiliou", "Antoniou", "Christodoulou", "Konstantinou", "Papageorgiou"] },
  NO: { w: 1, first: ["Magnus", "Ingrid", "Erik", "Emma", "Jonas", "Nora", "Henrik", "Maja", "Sander", "Thea"], last: ["Haugen", "Olsen", "Hansen", "Andersen", "Johansen", "Berg", "Larsen", "Kristiansen", "Pedersen", "Nilsen"] },
  DK: { w: 1, first: ["Mikkel", "Freja", "Oliver", "Ida", "Emil", "Clara", "Lucas", "Anna", "William", "Mathilde"], last: ["Nielsen", "Jensen", "Andersen", "Christensen", "Larsen", "Sørensen", "Rasmussen", "Petersen", "Madsen", "Kristensen"] },
  FI: { w: 1, first: ["Elias", "Aino", "Väinö", "Emilia", "Leevi", "Helmi", "Onni", "Sofia", "Eino", "Aada"], last: ["Korhonen", "Virtanen", "Mäkinen", "Nieminen", "Mäkelä", "Hämäläinen", "Laine", "Heikkinen", "Koskinen", "Järvinen"] },
  RU: { w: 3, first: ["Dmitri", "Anastasia", "Ivan", "Olga", "Sergei", "Ekaterina", "Alexei", "Maria", "Nikolai", "Natalia"], last: ["Volkov", "Ivanov", "Petrov", "Sokolova", "Smirnov", "Kuznetsov", "Popov", "Vasiliev", "Fedorov", "Morozova"] },
  PL: { w: 3, first: ["Jakub", "Zofia", "Piotr", "Anna", "Michał", "Maria", "Tomasz", "Katarzyna", "Krzysztof", "Agnieszka"], last: ["Kowalski", "Nowak", "Wiśniewski", "Wójcik", "Kowalczyk", "Kamiński", "Lewandowski", "Zieliński", "Szymański", "Dąbrowski"] },
  CZ: { w: 1, first: ["Jakub", "Tereza", "Jan", "Eliška", "Tomáš", "Kateřina", "Martin", "Petra", "Lukáš", "Barbora"], last: ["Novák", "Svoboda", "Dvořák", "Procházka", "Novotný", "Horák", "Marek", "Kučera", "Pospíšil", "Beneš"] },
  HU: { w: 1, first: ["Bence", "Zsófia", "Levente", "Anna", "Máté", "Panna", "Dániel", "Emma", "Zoltán", "Réka"], last: ["Szabó", "Nagy", "Kovács", "Tóth", "Horváth", "Varga", "Kiss", "Molnár", "Németh", "Farkas"] },
  RO: { w: 1, first: ["Andrei", "Ioana", "Alexandru", "Maria", "Mihai", "Elena", "Ștefan", "Ana", "Gabriel", "Cristina"], last: ["Popescu", "Ionescu", "Popa", "Dumitru", "Stan", "Stoica", "Gheorghe", "Constantin", "Marin", "Dinu"] },
  US: { w: 8, first: ["Michael", "Emily", "James", "Jessica", "David", "Ashley", "Robert", "Sarah", "William", "Amanda", "Christopher", "Elizabeth", "Matthew", "Megan", "Daniel", "Rachel"], last: ["Johnson", "Williams", "Brown", "Davis", "Miller", "Wilson", "Moore", "Taylor", "Anderson", "Thomas", "Jackson", "White", "Harris", "Martin", "Thompson", "Clark"] },
  MX: { w: 4, first: ["Diego", "Valentina", "Santiago", "Camila", "Alejandro", "Ximena", "Emiliano", "Regina", "Mateo", "Fernanda", "Leonardo", "Paulina"], last: ["Hernández", "García", "Martínez", "López", "González", "Ramírez", "Flores", "Torres", "Vázquez", "Reyes", "Jiménez", "Morales"] },
  BR: { w: 5, first: ["Lucas", "Beatriz", "Gabriel", "Larissa", "Matheus", "Juliana", "Rafael", "Camila", "Bruno", "Fernanda", "Felipe", "Mariana"], last: ["Silva", "Souza", "Oliveira", "Pereira", "Costa", "Rodrigues", "Almeida", "Carvalho", "Gomes", "Martins", "Araújo", "Barbosa"] },
  AR: { w: 2, first: ["Mateo", "Valentina", "Franco", "Martina", "Joaquín", "Sofía", "Tomás", "Julieta", "Nicolás", "Catalina"], last: ["Rojas", "Fernández", "González", "Díaz", "Romero", "Sosa", "Acosta", "Molina", "Torres", "Suárez"] },
  CO: { w: 2, first: ["Santiago", "Mariana", "Juan", "Valeria", "Andrés", "Isabella", "Sebastián", "Daniela", "Nicolás", "Laura"], last: ["Gómez", "Rodríguez", "Martínez", "López", "García", "Pérez", "Ramírez", "Castro", "Ortiz", "Vargas"] },
  CL: { w: 1, first: ["Sebastián", "Fernanda", "Matías", "Camila", "Benjamín", "Antonia", "Vicente", "Javiera", "Diego", "Constanza"], last: ["Muñoz", "Contreras", "Rojas", "Vargas", "Fuentes", "Torres", "Espinoza", "Reyes", "Silva", "Castillo"] },
  CN: { w: 6, first: ["Wei", "Mei", "Jun", "Xin", "Yan", "Feng", "Ling", "Hao", "Yun", "Qiang", "Fang", "Bo"], last: ["Zhang", "Wang", "Li", "Chen", "Liu", "Yang", "Huang", "Zhao", "Wu", "Zhou", "Xu", "Sun"] },
  KR: { w: 4, first: ["Ji-woo", "Min-jun", "Seo-yeon", "Joon", "Ha-eun", "Do-yoon", "Yu-jin", "Jae-won", "Soo-bin", "Eun-woo"], last: ["Kim", "Park", "Lee", "Choi", "Jung", "Kang", "Cho", "Yoon", "Jang", "Lim"] },
  IN: { w: 5, first: ["Arjun", "Ananya", "Rohan", "Priya", "Aditya", "Neha", "Vikram", "Pooja", "Karan", "Divya", "Siddharth", "Meera"], last: ["Sharma", "Patel", "Gupta", "Kumar", "Singh", "Reddy", "Rao", "Nair", "Mehta", "Joshi", "Agarwal", "Verma"] },
  PK: { w: 2, first: ["Ahmed", "Ayesha", "Bilal", "Sana", "Hassan", "Zara", "Usman", "Hira", "Omar", "Mahnoor"], last: ["Khan", "Malik", "Raza", "Butt", "Sheikh", "Qureshi", "Chaudhry", "Iqbal", "Baig", "Farooq"] },
  BD: { w: 1, first: ["Rafiq", "Nusrat", "Karim", "Farhana", "Sabbir", "Tasnim", "Imran", "Sharmin", "Nayeem", "Rina"], last: ["Ahmed", "Rahman", "Islam", "Hossain", "Chowdhury", "Khan", "Akter", "Haque", "Alam", "Sarker"] },
  ID: { w: 3, first: ["Bayu", "Putri", "Adi", "Dewi", "Agus", "Sri", "Andi", "Wulan", "Eko", "Ayu"], last: ["Pratama", "Santoso", "Wijaya", "Kusuma", "Saputra", "Hidayat", "Setiawan", "Purnomo", "Wibowo", "Susanto"] },
  TH: { w: 2, first: ["Somchai", "Siriporn", "Anong", "Krit", "Thawatchai", "Pim", "Niran", "Wanida", "Chai", "Malee"], last: ["Charoen", "Suwan", "Boonmee", "Saetang", "Saelim", "Rattanakul", "Wongsawat", "Chaiyaporn", "Thongchai", "Sukjai"] },
  VN: { w: 2, first: ["Minh", "Linh", "Nam", "Huong", "Duc", "Mai", "Thanh", "Lan", "Hung", "Thu"], last: ["Nguyen", "Tran", "Le", "Pham", "Hoang", "Phan", "Vu", "Dang", "Bui", "Do"] },
  PH: { w: 2, first: ["Miguel", "Andrea", "Josef", "Angela", "Carlo", "Maria", "Paolo", "Isabel", "Rafael", "Camille"], last: ["Santos", "Reyes", "Cruz", "Garcia", "Torres", "Ramos", "Mendoza", "Flores", "Villanueva", "Del Rosario"] },
  MY: { w: 1, first: ["Nur", "Aisyah", "Danish", "Farah", "Amir", "Nadia", "Haris", "Syafiqah", "Zul", "Iman"], last: ["Ismail", "Rahman", "Yusof", "Hassan", "Ibrahim", "Osman", "Abdullah", "Karim", "Ahmad", "Aziz"] },
  SG: { w: 1, first: ["Wei Jie", "Michelle", "Kai", "Hui Ling", "Jun Wei", "Sarah", "Zhi Hao", "Amanda", "Yong", "Priya"], last: ["Tan", "Lim", "Lee", "Ng", "Ong", "Goh", "Chua", "Koh", "Teo", "Wong"] },
  IL: { w: 2, first: ["Noa", "David", "Maya", "Omer", "Yael", "Itai", "Shira", "Tomer", "Adi", "Eitan"], last: ["Cohen", "Levi", "Mizrahi", "Peretz", "Biton", "Avraham", "Friedman", "Katz", "Dahan", "Azoulay"] },
  TR: { w: 3, first: ["Emre", "Elif", "Mehmet", "Zeynep", "Ahmet", "Ayşe", "Mustafa", "Fatma", "Can", "Selin"], last: ["Yılmaz", "Kaya", "Demir", "Şahin", "Çelik", "Yıldız", "Yıldırım", "Öztürk", "Aydın", "Özdemir"] },
  ZA: { w: 2, first: ["Sipho", "Thandi", "Johan", "Lerato", "Kagiso", "Naledi", "Pieter", "Zanele", "Bongani", "Amahle"], last: ["Nkosi", "Dlamini", "van der Merwe", "Botha", "Khumalo", "Mokoena", "Nel", "Zulu", "Venter", "Mahlangu"] },
  KE: { w: 1, first: ["Brian", "Amina", "Kevin", "Wanjiru", "David", "Grace", "Peter", "Njeri", "James", "Achieng"], last: ["Otieno", "Kamau", "Mwangi", "Njoroge", "Ochieng", "Wanjiru", "Kariuki", "Onyango", "Maina", "Wafula"] },
  GH: { w: 1, first: ["Kwame", "Ama", "Kofi", "Akosua", "Yaw", "Abena", "Kwabena", "Adjoa", "Kojo", "Efua"], last: ["Mensah", "Owusu", "Asante", "Boateng", "Appiah", "Osei", "Agyeman", "Darko", "Amankwah", "Ofori"] },
  AU: { w: 3, first: ["Jack", "Chloe", "William", "Olivia", "Oliver", "Charlotte", "Noah", "Mia", "Lucas", "Ava", "Ethan", "Grace"], last: ["Anderson", "Wilson", "Taylor", "Thompson", "Robinson", "Walker", "White", "Harris", "Martin", "Clarke", "Bell", "King"] },
  NZ: { w: 1, first: ["Liam", "Charlotte", "Jack", "Emily", "James", "Isla", "Oliver", "Ruby", "Noah", "Amelia"], last: ["Reid", "Anderson", "Taylor", "Wilson", "Mitchell", "Campbell", "Stewart", "Robertson", "Thompson", "Henderson"] },
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

// Guarantee exact uniqueness (not just low collision odds): track every
// display_name already in use, plus every name generated so far in this
// run, and retry until a pick isn't taken. ~15% of the time the leader
// goes by a single name only (first name alone) -- a real pattern for
// some traders/influencers, and it widens the identity space beyond
// pure first+last combinatorics.
const { rows: existingNameRows } = await client.query(`select display_name from public.providers`);
const usedNames = new Set(existingNameRows.map((r) => r.display_name));

function pickUniqueName(country) {
  const pool = INTL_NAME_POOLS[country];
  for (let attempt = 0; attempt < 50; attempt++) {
    const useSingleName = Math.random() < 0.15;
    const name = useSingleName ? pick(pool.first) : `${pick(pool.first)} ${pick(pool.last)}`;
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
  }
  // Pool exhausted for this country (shouldn't happen at our scale) --
  // fall back to a name from a random other country rather than loop forever.
  const otherCountry = pick(Object.keys(INTL_NAME_POOLS).filter((c) => c !== country));
  return pickUniqueName(otherCountry);
}

const updates = eligible.map((r) => {
  const country = pick(COUNTRY_POOL);
  const name = pickUniqueName(country);
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
