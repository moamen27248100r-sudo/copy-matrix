// One-time fix: expand-international-leaders.mjs originally drew from a
// 4-first/4-last-name pool per country (16 combos), which produced ~410
// duplicate display_name collisions across the platform's non-Arab leaders
// (e.g. "Michael Brown" x7) -- a birthday-paradox result of that tiny pool,
// not a data-entry mistake. Arabic-named leaders have zero duplicates
// (confirmed: 569/569 distinct), so this only touches Latin-script names.
//
// Uses the same (now much larger, see expand-international-leaders.mjs)
// per-country name pools, picks a REPLACEMENT name for every leader in a
// duplicate group except one (kept as-is), and retries until the pick is
// unique against every current display_name -- so this doesn't just lower
// collision odds, it guarantees zero duplicates remain. ~15% of
// replacements go by a single name only (first name alone), per explicit
// customer request for more identity variety.
//
// Country/bio are left untouched -- only display_name changes.
// Usage: node scripts/fix-duplicate-leader-names.mjs [--dry-run]
import { Client } from "pg";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

const dryRun = process.argv.includes("--dry-run");

const INTL_NAME_POOLS = {
  DE: { first: ["Lukas", "Anna", "Max", "Lena", "Paul", "Laura", "Jonas", "Julia", "Finn", "Sophie", "Tim", "Hannah"], last: ["Müller", "Schmidt", "Weber", "Becker", "Schneider", "Hoffmann", "Koch", "Richter", "Klein", "Wolf", "Schäfer", "Zimmermann"] },
  FR: { first: ["Louis", "Emma", "Hugo", "Camille", "Léo", "Chloé", "Nathan", "Manon", "Théo", "Léa", "Antoine", "Julie"], last: ["Martin", "Bernard", "Dubois", "Girard", "Thomas", "Robert", "Petit", "Durand", "Moreau", "Lefebvre", "Roux", "Fournier"] },
  IT: { first: ["Marco", "Giulia", "Luca", "Chiara", "Alessandro", "Francesca", "Matteo", "Sara", "Andrea", "Elena", "Davide", "Valentina"], last: ["Rossi", "Russo", "Ferrari", "Esposito", "Bianchi", "Romano", "Colombo", "Ricci", "Marino", "Greco", "Bruno", "Gallo"] },
  ES: { first: ["Pablo", "Lucía", "Alejandro", "María", "Carlos", "Carmen", "Javier", "Elena", "Daniel", "Marta", "Sergio", "Laura"], last: ["García", "Martínez", "López", "Sánchez", "González", "Pérez", "Rodríguez", "Fernández", "Gómez", "Ruiz", "Díaz", "Moreno"] },
  PT: { first: ["João", "Beatriz", "Tiago", "Ana", "Miguel", "Inês", "Rui", "Catarina", "Bruno", "Sofia"], last: ["Silva", "Santos", "Ferreira", "Pereira", "Costa", "Rodrigues", "Carvalho", "Gomes", "Martins", "Ribeiro"] },
  NL: { first: ["Daan", "Sanne", "Sem", "Eva", "Lars", "Fleur", "Bram", "Iris", "Thijs", "Anne"], last: ["de Jong", "Jansen", "de Vries", "Bakker", "Visser", "Smit", "Meijer", "de Boer", "Mulder", "Dekker"] },
  BE: { first: ["Lucas", "Marie", "Louis", "Emma", "Arthur", "Julie", "Noah", "Charlotte", "Victor", "Léa"], last: ["Peeters", "Janssens", "Maes", "Jacobs", "Mertens", "Willems", "Claes", "Goossens", "Wouters", "De Smet"] },
  AT: { first: ["Jonas", "Anna", "Felix", "Lena", "David", "Laura", "Simon", "Julia", "Paul", "Sophie"], last: ["Gruber", "Huber", "Bauer", "Wagner", "Pichler", "Steiner", "Moser", "Berger", "Fuchs", "Winkler"] },
  IE: { first: ["Sean", "Aoife", "Liam", "Niamh", "Conor", "Ciara", "Cian", "Saoirse", "Darragh", "Róisín"], last: ["Byrne", "Murphy", "Kelly", "Walsh", "O'Brien", "Ryan", "O'Connor", "Doyle", "McCarthy", "Gallagher"] },
  GR: { first: ["Nikos", "Eleni", "Giorgos", "Maria", "Dimitris", "Sofia", "Kostas", "Katerina", "Yannis", "Anna"], last: ["Papadopoulos", "Georgiou", "Ioannou", "Nikolaou", "Papadakis", "Vasiliou", "Antoniou", "Christodoulou", "Konstantinou", "Papageorgiou"] },
  NO: { first: ["Magnus", "Ingrid", "Erik", "Emma", "Jonas", "Nora", "Henrik", "Maja", "Sander", "Thea"], last: ["Haugen", "Olsen", "Hansen", "Andersen", "Johansen", "Berg", "Larsen", "Kristiansen", "Pedersen", "Nilsen"] },
  DK: { first: ["Mikkel", "Freja", "Oliver", "Ida", "Emil", "Clara", "Lucas", "Anna", "William", "Mathilde"], last: ["Nielsen", "Jensen", "Andersen", "Christensen", "Larsen", "Sørensen", "Rasmussen", "Petersen", "Madsen", "Kristensen"] },
  FI: { first: ["Elias", "Aino", "Väinö", "Emilia", "Leevi", "Helmi", "Onni", "Sofia", "Eino", "Aada"], last: ["Korhonen", "Virtanen", "Mäkinen", "Nieminen", "Mäkelä", "Hämäläinen", "Laine", "Heikkinen", "Koskinen", "Järvinen"] },
  RU: { first: ["Dmitri", "Anastasia", "Ivan", "Olga", "Sergei", "Ekaterina", "Alexei", "Maria", "Nikolai", "Natalia"], last: ["Volkov", "Ivanov", "Petrov", "Sokolova", "Smirnov", "Kuznetsov", "Popov", "Vasiliev", "Fedorov", "Morozova"] },
  PL: { first: ["Jakub", "Zofia", "Piotr", "Anna", "Michał", "Maria", "Tomasz", "Katarzyna", "Krzysztof", "Agnieszka"], last: ["Kowalski", "Nowak", "Wiśniewski", "Wójcik", "Kowalczyk", "Kamiński", "Lewandowski", "Zieliński", "Szymański", "Dąbrowski"] },
  CZ: { first: ["Jakub", "Tereza", "Jan", "Eliška", "Tomáš", "Kateřina", "Martin", "Petra", "Lukáš", "Barbora"], last: ["Novák", "Svoboda", "Dvořák", "Procházka", "Novotný", "Horák", "Marek", "Kučera", "Pospíšil", "Beneš"] },
  HU: { first: ["Bence", "Zsófia", "Levente", "Anna", "Máté", "Panna", "Dániel", "Emma", "Zoltán", "Réka"], last: ["Szabó", "Nagy", "Kovács", "Tóth", "Horváth", "Varga", "Kiss", "Molnár", "Németh", "Farkas"] },
  RO: { first: ["Andrei", "Ioana", "Alexandru", "Maria", "Mihai", "Elena", "Ștefan", "Ana", "Gabriel", "Cristina"], last: ["Popescu", "Ionescu", "Popa", "Dumitru", "Stan", "Stoica", "Gheorghe", "Constantin", "Marin", "Dinu"] },
  US: { first: ["Michael", "Emily", "James", "Jessica", "David", "Ashley", "Robert", "Sarah", "William", "Amanda", "Christopher", "Elizabeth", "Matthew", "Megan", "Daniel", "Rachel"], last: ["Johnson", "Williams", "Brown", "Davis", "Miller", "Wilson", "Moore", "Taylor", "Anderson", "Thomas", "Jackson", "White", "Harris", "Martin", "Thompson", "Clark"] },
  MX: { first: ["Diego", "Valentina", "Santiago", "Camila", "Alejandro", "Ximena", "Emiliano", "Regina", "Mateo", "Fernanda", "Leonardo", "Paulina"], last: ["Hernández", "García", "Martínez", "López", "González", "Ramírez", "Flores", "Torres", "Vázquez", "Reyes", "Jiménez", "Morales"] },
  BR: { first: ["Lucas", "Beatriz", "Gabriel", "Larissa", "Matheus", "Juliana", "Rafael", "Camila", "Bruno", "Fernanda", "Felipe", "Mariana"], last: ["Silva", "Souza", "Oliveira", "Pereira", "Costa", "Rodrigues", "Almeida", "Carvalho", "Gomes", "Martins", "Araújo", "Barbosa"] },
  AR: { first: ["Mateo", "Valentina", "Franco", "Martina", "Joaquín", "Sofía", "Tomás", "Julieta", "Nicolás", "Catalina"], last: ["Rojas", "Fernández", "González", "Díaz", "Romero", "Sosa", "Acosta", "Molina", "Torres", "Suárez"] },
  CO: { first: ["Santiago", "Mariana", "Juan", "Valeria", "Andrés", "Isabella", "Sebastián", "Daniela", "Nicolás", "Laura"], last: ["Gómez", "Rodríguez", "Martínez", "López", "García", "Pérez", "Ramírez", "Castro", "Ortiz", "Vargas"] },
  CL: { first: ["Sebastián", "Fernanda", "Matías", "Camila", "Benjamín", "Antonia", "Vicente", "Javiera", "Diego", "Constanza"], last: ["Muñoz", "Contreras", "Rojas", "Vargas", "Fuentes", "Torres", "Espinoza", "Reyes", "Silva", "Castillo"] },
  CN: { first: ["Wei", "Mei", "Jun", "Xin", "Yan", "Feng", "Ling", "Hao", "Yun", "Qiang", "Fang", "Bo"], last: ["Zhang", "Wang", "Li", "Chen", "Liu", "Yang", "Huang", "Zhao", "Wu", "Zhou", "Xu", "Sun"] },
  KR: { first: ["Ji-woo", "Min-jun", "Seo-yeon", "Joon", "Ha-eun", "Do-yoon", "Yu-jin", "Jae-won", "Soo-bin", "Eun-woo"], last: ["Kim", "Park", "Lee", "Choi", "Jung", "Kang", "Cho", "Yoon", "Jang", "Lim"] },
  IN: { first: ["Arjun", "Ananya", "Rohan", "Priya", "Aditya", "Neha", "Vikram", "Pooja", "Karan", "Divya", "Siddharth", "Meera"], last: ["Sharma", "Patel", "Gupta", "Kumar", "Singh", "Reddy", "Rao", "Nair", "Mehta", "Joshi", "Agarwal", "Verma"] },
  PK: { first: ["Ahmed", "Ayesha", "Bilal", "Sana", "Hassan", "Zara", "Usman", "Hira", "Omar", "Mahnoor"], last: ["Khan", "Malik", "Raza", "Butt", "Sheikh", "Qureshi", "Chaudhry", "Iqbal", "Baig", "Farooq"] },
  BD: { first: ["Rafiq", "Nusrat", "Karim", "Farhana", "Sabbir", "Tasnim", "Imran", "Sharmin", "Nayeem", "Rina"], last: ["Ahmed", "Rahman", "Islam", "Hossain", "Chowdhury", "Khan", "Akter", "Haque", "Alam", "Sarker"] },
  ID: { first: ["Bayu", "Putri", "Adi", "Dewi", "Agus", "Sri", "Andi", "Wulan", "Eko", "Ayu"], last: ["Pratama", "Santoso", "Wijaya", "Kusuma", "Saputra", "Hidayat", "Setiawan", "Purnomo", "Wibowo", "Susanto"] },
  TH: { first: ["Somchai", "Siriporn", "Anong", "Krit", "Thawatchai", "Pim", "Niran", "Wanida", "Chai", "Malee"], last: ["Charoen", "Suwan", "Boonmee", "Saetang", "Saelim", "Rattanakul", "Wongsawat", "Chaiyaporn", "Thongchai", "Sukjai"] },
  VN: { first: ["Minh", "Linh", "Nam", "Huong", "Duc", "Mai", "Thanh", "Lan", "Hung", "Thu"], last: ["Nguyen", "Tran", "Le", "Pham", "Hoang", "Phan", "Vu", "Dang", "Bui", "Do"] },
  PH: { first: ["Miguel", "Andrea", "Josef", "Angela", "Carlo", "Maria", "Paolo", "Isabel", "Rafael", "Camille"], last: ["Santos", "Reyes", "Cruz", "Garcia", "Torres", "Ramos", "Mendoza", "Flores", "Villanueva", "Del Rosario"] },
  MY: { first: ["Nur", "Aisyah", "Danish", "Farah", "Amir", "Nadia", "Haris", "Syafiqah", "Zul", "Iman"], last: ["Ismail", "Rahman", "Yusof", "Hassan", "Ibrahim", "Osman", "Abdullah", "Karim", "Ahmad", "Aziz"] },
  SG: { first: ["Wei Jie", "Michelle", "Kai", "Hui Ling", "Jun Wei", "Sarah", "Zhi Hao", "Amanda", "Yong", "Priya"], last: ["Tan", "Lim", "Lee", "Ng", "Ong", "Goh", "Chua", "Koh", "Teo", "Wong"] },
  IL: { first: ["Noa", "David", "Maya", "Omer", "Yael", "Itai", "Shira", "Tomer", "Adi", "Eitan"], last: ["Cohen", "Levi", "Mizrahi", "Peretz", "Biton", "Avraham", "Friedman", "Katz", "Dahan", "Azoulay"] },
  TR: { first: ["Emre", "Elif", "Mehmet", "Zeynep", "Ahmet", "Ayşe", "Mustafa", "Fatma", "Can", "Selin"], last: ["Yılmaz", "Kaya", "Demir", "Şahin", "Çelik", "Yıldız", "Yıldırım", "Öztürk", "Aydın", "Özdemir"] },
  ZA: { first: ["Sipho", "Thandi", "Johan", "Lerato", "Kagiso", "Naledi", "Pieter", "Zanele", "Bongani", "Amahle"], last: ["Nkosi", "Dlamini", "van der Merwe", "Botha", "Khumalo", "Mokoena", "Nel", "Zulu", "Venter", "Mahlangu"] },
  KE: { first: ["Brian", "Amina", "Kevin", "Wanjiru", "David", "Grace", "Peter", "Njeri", "James", "Achieng"], last: ["Otieno", "Kamau", "Mwangi", "Njoroge", "Ochieng", "Wanjiru", "Kariuki", "Onyango", "Maina", "Wafula"] },
  GH: { first: ["Kwame", "Ama", "Kofi", "Akosua", "Yaw", "Abena", "Kwabena", "Adjoa", "Kojo", "Efua"], last: ["Mensah", "Owusu", "Asante", "Boateng", "Appiah", "Osei", "Agyeman", "Darko", "Amankwah", "Ofori"] },
  AU: { first: ["Jack", "Chloe", "William", "Olivia", "Oliver", "Charlotte", "Noah", "Mia", "Lucas", "Ava", "Ethan", "Grace"], last: ["Anderson", "Wilson", "Taylor", "Thompson", "Robinson", "Walker", "White", "Harris", "Martin", "Clarke", "Bell", "King"] },
  NZ: { first: ["Liam", "Charlotte", "Jack", "Emily", "James", "Isla", "Oliver", "Ruby", "Noah", "Amelia"], last: ["Reid", "Anderson", "Taylor", "Wilson", "Mitchell", "Campbell", "Stewart", "Robertson", "Thompson", "Henderson"] },
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const client = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

// Group by display_name ALONE (not name+country) -- the same name could
// have been drawn for two leaders in different countries whose pools
// happen to share a first/last name (e.g. "Anna" appears in DE/AT/PL/RU/DK),
// and that's still a visible duplicate on the site regardless of country.
const { rows: dupNames } = await client.query(`
  select display_name from public.providers
  where display_name !~ '[؀-ۿ]' and not is_archived
  group by display_name having count(*) > 1
`);
const { rows: dupRows } = await client.query(
  `select id, display_name, country, created_at from public.providers where display_name = any($1) order by display_name, created_at asc`,
  [dupNames.map((r) => r.display_name)],
);
const dupGroups = [];
for (const row of dupRows) {
  let group = dupGroups.find((g) => g.display_name === row.display_name);
  if (!group) {
    group = { display_name: row.display_name, rows: [] };
    dupGroups.push(group);
  }
  group.rows.push(row);
}

const { rows: allNames } = await client.query(`select display_name from public.providers`);
const usedNames = new Set(allNames.map((r) => r.display_name));

function pickUniqueName(country) {
  const pool = INTL_NAME_POOLS[country] ?? INTL_NAME_POOLS.US;
  for (let attempt = 0; attempt < 50; attempt++) {
    const useSingleName = Math.random() < 0.15;
    const name = useSingleName ? pick(pool.first) : `${pick(pool.first)} ${pick(pool.last)}`;
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
  }
  const otherCountry = pick(Object.keys(INTL_NAME_POOLS).filter((c) => c !== country));
  return pickUniqueName(otherCountry);
}

const updates = [];
const sample = [];
for (const group of dupGroups) {
  // Keep the oldest one as-is, rename the rest -- each using ITS OWN
  // country's pool (duplicate leaders can have different countries).
  const [, ...toRename] = group.rows;
  for (const row of toRename) {
    const newName = pickUniqueName(row.country);
    updates.push({ id: row.id, newName });
    if (sample.length < 25) sample.push(`${group.display_name} (${row.country}) -> ${newName}`);
  }
}

console.log(`${dupGroups.length} duplicate-name groups found, renaming ${updates.length} leaders`);
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
    `update public.providers p set display_name = v.name from unnest($1::uuid[], $2::text[]) as v(id, name) where p.id = v.id`,
    [chunk.map((u) => u.id), chunk.map((u) => u.newName)],
  );
}
console.log("done. Refreshing provider_performance...");
await client.query(`select public.refresh_provider_performance()`);
console.log("Done.");

await client.end();
