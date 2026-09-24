// Full reseed: give each leader's base_followers_count padding number
// real per-row identity — a distinct synthetic customer per unit of
// base_followers_count, each with its own name (foreign for foreign
// leaders, mostly Arabic otherwise), starting capital (scaled by the
// leader's own min_copy_amount in fixed proportions, with a "whale" tier
// reserved for old customers of low-risk leaders), and join date. current_capital is computed
// by walking that leader's REAL historical closed trades step-by-step
// from the customer's own join date forward, interleaving a withdrawal
// roll at each winning step AND a pause/resume walk — a customer whose
// capital crosses their own proportional floor (10% of starting
// capital) pauses (stops experiencing further trades) until a
// time-calibrated resume roll gives them fresh capital, mirroring the
// live engine's per-minute resume mechanic. Purely decorative/
// synthetic — not tied to real profiles/subscriptions in any way.
//
// This DELETES and regenerates all existing synthetic_customers rows
// (cascades to synthetic_customer_withdrawals/synthetic_customer_pauses)
// — safe because nothing else references these ids yet.
//
// Usage: node scripts/backfill-synthetic-customers.mjs [--dry-run]
import { Client } from "pg";
import { config } from "dotenv";
import crypto from "node:crypto";
config({ path: ".env.local", quiet: true });

const dryRun = process.argv.includes("--dry-run");

const CUSTOMER_FIRST_AR = [
  "أحمد", "محمد", "علي", "حسين", "إبراهيم", "عبدالله", "يوسف", "خالد", "سعيد", "طارق",
  "فاطمة", "مريم", "نورة", "هدى", "سارة", "ريم", "منى", "عائشة", "زينب", "لمى",
  "عمر", "بلال", "وليد", "ماجد", "رامي", "سلمى", "دانة", "شهد", "جود", "لين",
];
const CUSTOMER_LAST_AR = [
  "الشريف", "العتيبي", "المطيري", "القحطاني", "الزهراني", "النجار", "حداد", "صالح", "شاهين", "كنعان",
  "درويش", "سالم", "بركات", "عيسى", "قاسم", "حمدان", "الجابر", "السيد", "مراد", "توفيق",
];
// Generic fallback pool -- only used for a non-Arab country that (for
// whatever reason) has no dedicated pool below, or as the "other country"
// diversity slice for a leader whose own country DOES have a pool.
const CUSTOMER_FIRST_INTL = [
  "David", "Anna", "Lucas", "Maria", "John", "Olivia", "Elena", "Ryan", "Sofia", "Thomas",
  "Laura", "Marco", "Julia", "Erik", "Charlotte", "Felix", "Camille", "Jonas", "Chloe", "Pablo",
  "Yuki", "Wei", "Ji-woo", "Haruto", "Mei", "Kenji", "Xin", "Somchai", "Nur", "Minh",
  "Diego", "Valentina", "Mariana", "Sebastián", "Beatriz", "Rodrigo", "Camila", "Andrés",
];
const CUSTOMER_LAST_INTL = [
  "Kim", "Petrova", "Costa", "Santos", "Miller", "Wright", "Malik", "Popescu", "O'Connor", "Rossi",
  "Wagner", "Novak", "Larsen", "Fischer", "Dubois", "Tanaka", "Zhang", "Nguyen", "Sharma", "Haugen",
  "Hernández", "Gómez", "Muñoz", "Vargas", "Silva", "Rojas",
];

const ARAB_COUNTRY_SET = new Set([
  "SA", "EG", "AE", "IQ", "MA", "DZ", "KW", "JO", "TN", "SY", "YE", "SD",
  "QA", "BH", "OM", "LB", "LY", "PS", "MR", "SO",
]);

// One small first/last-name pool per non-Arab country a leader can have
// (providers.country, per assign-leader-countries.mjs / backfill-global-
// leader-identities.mjs), so a leader's customers mostly get names that
// actually match their own country instead of a single flat "generic
// international" pool that ignores which country the leader is from.
const INTL_NAME_POOLS = {
  DE: { first: ["Lukas", "Anna", "Max", "Lena"], last: ["Müller", "Schmidt", "Weber", "Becker"] },
  FR: { first: ["Louis", "Emma", "Hugo", "Camille"], last: ["Martin", "Bernard", "Dubois", "Girard"] },
  IT: { first: ["Marco", "Giulia", "Luca", "Chiara"], last: ["Rossi", "Russo", "Ferrari", "Esposito"] },
  ES: { first: ["Pablo", "Lucía", "Alejandro", "María"], last: ["García", "Martínez", "López", "Sánchez"] },
  PT: { first: ["João", "Beatriz", "Tiago", "Ana"], last: ["Silva", "Santos", "Ferreira", "Pereira"] },
  NL: { first: ["Daan", "Sanne", "Sem", "Eva"], last: ["de Jong", "Jansen", "de Vries", "Bakker"] },
  BE: { first: ["Lucas", "Marie", "Louis", "Emma"], last: ["Peeters", "Janssens", "Maes", "Jacobs"] },
  AT: { first: ["Jonas", "Anna", "Felix", "Lena"], last: ["Gruber", "Huber", "Bauer", "Wagner"] },
  IE: { first: ["Sean", "Aoife", "Liam", "Niamh"], last: ["Byrne", "Murphy", "Kelly", "Walsh"] },
  GR: { first: ["Nikos", "Eleni", "Giorgos", "Maria"], last: ["Papadopoulos", "Georgiou", "Ioannou", "Nikolaou"] },
  NO: { first: ["Magnus", "Ingrid", "Erik", "Emma"], last: ["Haugen", "Olsen", "Hansen", "Andersen"] },
  DK: { first: ["Mikkel", "Freja", "Oliver", "Ida"], last: ["Nielsen", "Jensen", "Andersen", "Christensen"] },
  FI: { first: ["Elias", "Aino", "Väinö", "Emilia"], last: ["Korhonen", "Virtanen", "Mäkinen", "Nieminen"] },
  RU: { first: ["Dmitri", "Anastasia", "Ivan", "Olga"], last: ["Volkov", "Ivanov", "Petrov", "Sokolova"] },
  PL: { first: ["Jakub", "Zofia", "Piotr", "Anna"], last: ["Kowalski", "Nowak", "Wiśniewski", "Wójcik"] },
  CZ: { first: ["Jakub", "Tereza", "Jan", "Eliška"], last: ["Novák", "Svoboda", "Dvořák", "Procházka"] },
  HU: { first: ["Bence", "Zsófia", "Levente", "Anna"], last: ["Szabó", "Nagy", "Kovács", "Tóth"] },
  RO: { first: ["Andrei", "Ioana", "Alexandru", "Maria"], last: ["Popescu", "Ionescu", "Popa", "Dumitru"] },
  US: { first: ["Michael", "Emily", "James", "Jessica"], last: ["Johnson", "Williams", "Brown", "Davis"] },
  MX: { first: ["Diego", "Valentina", "Santiago", "Camila"], last: ["Hernández", "García", "Martínez", "López"] },
  BR: { first: ["Lucas", "Beatriz", "Gabriel", "Larissa"], last: ["Silva", "Souza", "Oliveira", "Pereira"] },
  AR: { first: ["Mateo", "Valentina", "Franco", "Martina"], last: ["Rojas", "Fernández", "González", "Díaz"] },
  CO: { first: ["Santiago", "Mariana", "Juan", "Valeria"], last: ["Gómez", "Rodríguez", "Martínez", "López"] },
  CL: { first: ["Sebastián", "Fernanda", "Matías", "Camila"], last: ["Muñoz", "Contreras", "Rojas", "Vargas"] },
  CN: { first: ["Wei", "Mei", "Jun", "Xin"], last: ["Zhang", "Wang", "Li", "Chen"] },
  KR: { first: ["Ji-woo", "Min-jun", "Seo-yeon", "Joon"], last: ["Kim", "Park", "Lee", "Choi"] },
  IN: { first: ["Arjun", "Ananya", "Rohan", "Priya"], last: ["Sharma", "Patel", "Gupta", "Kumar"] },
  PK: { first: ["Ahmed", "Ayesha", "Bilal", "Sana"], last: ["Khan", "Malik", "Ahmed", "Raza"] },
  BD: { first: ["Rafiq", "Nusrat", "Karim", "Farhana"], last: ["Ahmed", "Rahman", "Islam", "Hossain"] },
  ID: { first: ["Bayu", "Putri", "Adi", "Dewi"], last: ["Pratama", "Santoso", "Wijaya", "Kusuma"] },
  TH: { first: ["Somchai", "Siriporn", "Anong", "Krit"], last: ["Charoen", "Suwan", "Boonmee", "Saetang"] },
  VN: { first: ["Minh", "Linh", "Nam", "Huong"], last: ["Nguyen", "Tran", "Le", "Pham"] },
  PH: { first: ["Miguel", "Andrea", "Josef", "Angela"], last: ["Santos", "Reyes", "Cruz", "Garcia"] },
  MY: { first: ["Nur", "Aisyah", "Danish", "Farah"], last: ["Ismail", "Rahman", "Yusof", "Hassan"] },
  SG: { first: ["Wei Jie", "Michelle", "Kai", "Hui Ling"], last: ["Tan", "Lim", "Lee", "Ng"] },
  IL: { first: ["Noa", "David", "Maya", "Omer"], last: ["Cohen", "Levi", "Mizrahi", "Peretz"] },
  TR: { first: ["Emre", "Elif", "Mehmet", "Zeynep"], last: ["Yılmaz", "Kaya", "Demir", "Şahin"] },
  ZA: { first: ["Sipho", "Thandi", "Johan", "Lerato"], last: ["Nkosi", "Dlamini", "van der Merwe", "Botha"] },
  KE: { first: ["Brian", "Amina", "Kevin", "Wanjiru"], last: ["Otieno", "Kamau", "Wanjiru", "Mwangi"] },
  GH: { first: ["Kwame", "Ama", "Kofi", "Akosua"], last: ["Mensah", "Owusu", "Asante", "Boateng"] },
  AU: { first: ["Jack", "Chloe", "William", "Olivia"], last: ["Anderson", "Wilson", "Taylor", "Thompson"] },
  NZ: { first: ["Liam", "Charlotte", "Jack", "Emily"], last: ["Reid", "Anderson", "Taylor", "Wilson"] },
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function pickName(providerCountry) {
  const isArab = providerCountry != null && ARAB_COUNTRY_SET.has(providerCountry);

  if (providerCountry != null && !isArab) {
    // Non-Arab leader: mostly a name that matches their own specific
    // country, a smaller slice of generic "other country" diversity, and
    // a rare Arabic-diaspora customer -- never defaults to all-Arabic.
    const pool = INTL_NAME_POOLS[providerCountry];
    const roll = Math.random();
    if (pool && roll < 0.85) return `${pick(pool.first)} ${pick(pool.last)}`;
    if (roll < 0.95) return `${pick(CUSTOMER_FIRST_INTL)} ${pick(CUSTOMER_LAST_INTL)}`;
    return `${pick(CUSTOMER_FIRST_AR)} ${pick(CUSTOMER_LAST_AR)}`;
  }

  // Arab leader (or, defensively, no country at all): mostly Arabic, a
  // smaller slice of international diversity -- unchanged from before.
  if (Math.random() < 0.1) return `${pick(CUSTOMER_FIRST_INTL)} ${pick(CUSTOMER_LAST_INTL)}`;
  return `${pick(CUSTOMER_FIRST_AR)} ${pick(CUSTOMER_LAST_AR)}`;
}

function logUniform(min, max) {
  return min * Math.pow(max / min, Math.random());
}

// Capital now scales off the LEADER's own min_copy_amount in fixed
// proportions instead of a rating-derived flat ceiling (customer's
// explicit spec): 58% of customers deposit exactly the floor, 32% a bit
// above it (1.2x-3x), and a "whale" tier (4x-15x) is reserved for
// customers who are BOTH old (joined 4+ months ago -- reflects them
// having grown their own stake over time, not walking in with a huge sum
// day one) AND copying a low-risk leader (real money gravitates to
// stability, not to a leader who might blow up tomorrow). Everyone else
// who rolls into the "whale" bracket falls back to the mid tier instead.
function pickStartingCapital(capFloor, riskLevel, joinedAtMs, nowMs) {
  const monthsTenure = (nowMs - joinedAtMs) / (1000 * 60 * 60 * 24 * 30);
  const roll = Math.random();
  if (roll < 0.58) return capFloor;
  if (roll < 0.90 || riskLevel !== "منخفضة" || monthsTenure < 4) {
    return Math.round(logUniform(capFloor * 1.2, capFloor * 3) * 100) / 100;
  }
  return Math.round(logUniform(capFloor * 4, capFloor * 15) * 100) / 100;
}

const db = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await db.connect();

console.log("fetching providers...");
const { rows: providers } = await db.query(
  `select id, created_at, min_copy_amount, base_followers_count, country, total_profit from public.providers`,
);
console.log(`${providers.length} providers, total base_followers_count = ${providers.reduce((s, p) => s + p.base_followers_count, 0)}`);
const losingProviders = new Set(providers.filter((p) => Number(p.total_profit) < 0).map((p) => p.id));
console.log(`${losingProviders.size} net-losing providers -- their customers never withdraw`);

console.log("fetching provider risk levels...");
const { rows: riskRows } = await db.query(`select provider_id, risk_level from public.provider_cards`);
const riskLevelByProvider = new Map(riskRows.map((r) => [r.provider_id, r.risk_level]));

console.log("fetching closed signals...");
const { rows: signals } = await db.query(
  `select id, provider_id, side, entry_price, exit_price, opened_at, closed_at, close_trigger
   from public.signals
   where status = 'closed' and exit_price is not null and not created_by_admin
   order by provider_id, closed_at asc`,
);
console.log(`${signals.length} closed signals`);

const signalsByProvider = new Map();
for (const s of signals) {
  let arr = signalsByProvider.get(s.provider_id);
  if (!arr) {
    arr = [];
    signalsByProvider.set(s.provider_id, arr);
  }
  arr.push(s);
}

const WITHDRAWAL_PROB = 0.03;
const WITHDRAWAL_MIN_FRAC = 0.10;
const WITHDRAWAL_MAX_FRAC = 0.30;
const PAUSE_ROLL_PROB = 0.0003; // per qualifying step, independent of the floor-cross trigger
const RESUME_PER_MINUTE_PROB = 0.00005; // matches the live OPEN block's per-tick resume roll

const now = Date.now();
const customers = [];
const withdrawals = [];
const pauses = [];

for (const p of providers) {
  const createdAtMs = new Date(p.created_at).getTime();
  const providerSignals = signalsByProvider.get(p.id) ?? [];
  const capFloor = Math.max(Number(p.min_copy_amount) || 25, 25);
  const riskLevel = riskLevelByProvider.get(p.id) ?? null;
  const n = p.base_followers_count;

  for (let i = 0; i < n; i++) {
    const joinedAtMs = createdAtMs + Math.random() * (now - createdAtMs);
    const joinedAt = new Date(joinedAtMs);
    const startingCapital = pickStartingCapital(capFloor, riskLevel, joinedAtMs, now);
    const customerId = crypto.randomUUID();

    // Per-step bound (bounds every step of the walk, not just the end
    // result, so a long sequence of trades can't compound into an
    // absurd outlier) — also doubles as the "ran out of balance"
    // proportional floor for the pause trigger below. Ceiling
    // tightened from 15x to 8x alongside the capital-distribution fix
    // above, since a lower, more realistic starting point compounding
    // 15x still produced six-figure outliers.
    const floor = startingCapital * 0.1;
    const ceil = startingCapital * 8;

    let balance = startingCapital;
    let copyStatus = "active";
    let openPauseIdx = null;
    let lastCheckAtMs = null; // last time we rolled a resume check while paused

    for (const s of providerSignals) {
      const openedAtMs = new Date(s.opened_at).getTime();
      if (openedAtMs < joinedAtMs) continue;
      const eventAt = s.closed_at ?? s.opened_at;
      const eventAtMs = new Date(eventAt).getTime();

      if (copyStatus === "left") break; // permanent -- matches the live engine, no further trades ever apply

      if (copyStatus === "paused") {
        const gapMinutes = Math.max(0, (eventAtMs - lastCheckAtMs) / 60000);
        const resumeProb = 1 - Math.pow(1 - RESUME_PER_MINUTE_PROB, gapMinutes);
        if (Math.random() < resumeProb) {
          copyStatus = "active";
          balance = Math.max(10, Math.round(startingCapital * (0.3 + Math.random() * 0.5) * 100) / 100);
          pauses[openPauseIdx].resumedAt = eventAt;
          pauses[openPauseIdx].redepositAmount = balance;
          openPauseIdx = null;
        } else {
          lastCheckAtMs = eventAtMs;
          continue; // still paused: this trade does not apply, does not appear in this customer's history
        }
      }

      // Margin call: matches the live engine (0149/0150) -- drags the
      // customer down with the leader's own blown account, severe cut,
      // permanently marked 'left' (not 'paused' -- no resume, ever).
      if (s.close_trigger === "margin_call") {
        balance = Math.round(balance * (0.02 + Math.random() * 0.08) * 100) / 100;
        copyStatus = "left";
        pauses.push({ customerId, providerId: p.id, pausedAt: eventAt, resumedAt: null });
        break;
      }

      const raw = (Number(s.exit_price) - Number(s.entry_price)) / Number(s.entry_price);
      const signed = s.side === "sell" ? -raw : raw;
      const pnl = balance * signed;
      balance = Math.min(ceil, Math.max(floor, balance + pnl));

      if (pnl > 0 && !losingProviders.has(p.id) && Math.random() < WITHDRAWAL_PROB) {
        const amount =
          Math.round(pnl * (WITHDRAWAL_MIN_FRAC + Math.random() * (WITHDRAWAL_MAX_FRAC - WITHDRAWAL_MIN_FRAC)) * 100) / 100;
        if (amount > 0) {
          balance = Math.max(10, balance - amount);
          withdrawals.push({
            customerId,
            providerId: p.id,
            signalId: s.id,
            amount,
            occurredAt: eventAt,
          });
        }
      }

      if (balance <= floor || Math.random() < PAUSE_ROLL_PROB) {
        copyStatus = "paused";
        pauses.push({ customerId, providerId: p.id, pausedAt: eventAt, resumedAt: null });
        openPauseIdx = pauses.length - 1;
        lastCheckAtMs = eventAtMs;
      }
    }

    const currentCapital = Math.max(10, Math.round(balance * 100) / 100);

    customers.push({
      id: customerId,
      providerId: p.id,
      displayName: pickName(p.country),
      startingCapital,
      currentCapital,
      joinedAt: joinedAt.toISOString(),
      copyStatus,
    });
  }
}

console.log(`prepared ${customers.length} synthetic customers, ${withdrawals.length} withdrawal events, ${pauses.length} pause events`);

if (dryRun) {
  console.log("DRY RUN customer sample:", customers.slice(0, 5));
  console.log("DRY RUN withdrawal sample:", withdrawals.slice(0, 3));
  console.log("DRY RUN pause sample:", pauses.slice(0, 3));
  const totalStarting = customers.reduce((s, r) => s + r.startingCapital, 0);
  const totalCurrent = customers.reduce((s, r) => s + r.currentCapital, 0);
  console.log(`avg starting capital: ${(totalStarting / customers.length).toFixed(2)}`);
  console.log(`avg current capital: ${(totalCurrent / customers.length).toFixed(2)}`);
  const pausedCount = customers.filter((c) => c.copyStatus === "paused").length;
  console.log(`currently paused: ${pausedCount}/${customers.length} (${((pausedCount / customers.length) * 100).toFixed(2)}%)`);
  await db.end();
  process.exit(0);
}

console.log("deleting existing synthetic_customers (cascades to withdrawals/pauses)...");
await db.query(`delete from public.synthetic_customers`);

const CHUNK = 500;
for (let i = 0; i < customers.length; i += CHUNK) {
  const chunk = customers.slice(i, i + CHUNK);
  const values = chunk
    .map(
      (_, j) =>
        `($${j * 7 + 1}::uuid, $${j * 7 + 2}::uuid, $${j * 7 + 3}::text, $${j * 7 + 4}::numeric, $${j * 7 + 5}::numeric, $${j * 7 + 6}::timestamptz, $${j * 7 + 7}::text)`,
    )
    .join(",");
  const params = chunk.flatMap((r) => [
    r.id, r.providerId, r.displayName, r.startingCapital, r.currentCapital, r.joinedAt, r.copyStatus,
  ]);
  await db.query(
    `insert into public.synthetic_customers (id, provider_id, display_name, starting_capital, current_capital, joined_at, copy_status)
     values ${values}`,
    params,
  );
  process.stdout.write(`\rcustomers: ${Math.min(i + CHUNK, customers.length)}/${customers.length}`);
}
console.log();

for (let i = 0; i < withdrawals.length; i += CHUNK) {
  const chunk = withdrawals.slice(i, i + CHUNK);
  const values = chunk
    .map(
      (_, j) =>
        `($${j * 5 + 1}::uuid, $${j * 5 + 2}::uuid, $${j * 5 + 3}::uuid, $${j * 5 + 4}::numeric, $${j * 5 + 5}::timestamptz)`,
    )
    .join(",");
  const params = chunk.flatMap((w) => [w.customerId, w.providerId, w.signalId, w.amount, w.occurredAt]);
  await db.query(
    `insert into public.synthetic_customer_withdrawals (customer_id, provider_id, signal_id, amount, occurred_at)
     values ${values}`,
    params,
  );
  process.stdout.write(`\rwithdrawals: ${Math.min(i + CHUNK, withdrawals.length)}/${withdrawals.length}`);
}
console.log();

for (let i = 0; i < pauses.length; i += CHUNK) {
  const chunk = pauses.slice(i, i + CHUNK);
  const values = chunk
    .map(
      (_, j) =>
        `($${j * 5 + 1}::uuid, $${j * 5 + 2}::uuid, $${j * 5 + 3}::timestamptz, $${j * 5 + 4}::timestamptz, $${j * 5 + 5}::numeric)`,
    )
    .join(",");
  const params = chunk.flatMap((pa) => [pa.customerId, pa.providerId, pa.pausedAt, pa.resumedAt, pa.redepositAmount ?? null]);
  await db.query(
    `insert into public.synthetic_customer_pauses (customer_id, provider_id, paused_at, resumed_at, redeposit_amount)
     values ${values}`,
    params,
  );
  process.stdout.write(`\rpauses: ${Math.min(i + CHUNK, pauses.length)}/${pauses.length}`);
}
console.log("\ndone");
await db.end();
