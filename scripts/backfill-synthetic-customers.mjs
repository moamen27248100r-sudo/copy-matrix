// One-time: give each leader's base_followers_count padding number
// real per-row identity — a distinct synthetic customer per unit of
// base_followers_count, each with its own name, starting capital, and
// join date, with current_capital retroactively compounded through
// that leader's REAL historical closed trades from the customer's own
// join date forward (matching how real copy-trading only mirrors NEW
// signals after a follower joins). Purely decorative/synthetic — not
// tied to real profiles/subscriptions in any way.
//
// Usage: node scripts/backfill-synthetic-customers.mjs [--dry-run]
import { Client } from "pg";
import { config } from "dotenv";
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
const CUSTOMER_INTL = [
  ["David", "Kim"], ["Anna", "Petrova"], ["Lucas", "Costa"], ["Maria", "Santos"], ["John", "Miller"],
  ["Olivia", "Wright"], ["Hassan", "Malik"], ["Elena", "Popescu"], ["Ryan", "O'Connor"], ["Sofia", "Rossi"],
];

function pickName() {
  if (Math.random() < 0.1) {
    const [f, l] = CUSTOMER_INTL[Math.floor(Math.random() * CUSTOMER_INTL.length)];
    return `${f} ${l}`;
  }
  const f = CUSTOMER_FIRST_AR[Math.floor(Math.random() * CUSTOMER_FIRST_AR.length)];
  const l = CUSTOMER_LAST_AR[Math.floor(Math.random() * CUSTOMER_LAST_AR.length)];
  return `${f} ${l}`;
}

function logUniform(min, max) {
  return min * Math.pow(max / min, Math.random());
}

const db = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await db.connect();

console.log("fetching providers...");
const { rows: providers } = await db.query(
  `select id, created_at, min_copy_amount, base_followers_count from public.providers`,
);
console.log(`${providers.length} providers, total base_followers_count = ${providers.reduce((s, p) => s + p.base_followers_count, 0)}`);

console.log("fetching closed signals...");
const { rows: signals } = await db.query(
  `select provider_id, side, entry_price, exit_price, opened_at
   from public.signals
   where status = 'closed' and exit_price is not null
   order by provider_id, opened_at asc`,
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

const now = Date.now();
const rows = [];
for (const p of providers) {
  const createdAtMs = new Date(p.created_at).getTime();
  const providerSignals = signalsByProvider.get(p.id) ?? [];
  const capFloor = Math.max(Number(p.min_copy_amount) || 25, 25);
  const n = p.base_followers_count;

  for (let i = 0; i < n; i++) {
    const joinedAtMs = createdAtMs + Math.random() * (now - createdAtMs);
    const joinedAt = new Date(joinedAtMs);
    const startingCapital = Math.round(logUniform(capFloor, 50000) * 100) / 100;

    let factor = 1;
    for (const s of providerSignals) {
      if (new Date(s.opened_at).getTime() < joinedAtMs) continue;
      const raw = (Number(s.exit_price) - Number(s.entry_price)) / Number(s.entry_price);
      const signed = s.side === "sell" ? -raw : raw;
      factor *= 1 + signed;
    }
    // Compounding through months of real trade history can otherwise
    // produce absurd outliers (seen: a $316M result from a low-4-figure
    // start) for leaders with many trades and even a slight edge —
    // bound the final multiple to a plausible range for a demo
    // copy-trading account (lose up to 85%, gain up to 12x).
    factor = Math.max(0.15, Math.min(12, factor));

    const currentCapital = Math.max(10, Math.round(startingCapital * factor * 100) / 100);

    rows.push({
      providerId: p.id,
      displayName: pickName(),
      startingCapital,
      currentCapital,
      joinedAt: joinedAt.toISOString(),
    });
  }
}

console.log(`prepared ${rows.length} synthetic customers`);

if (dryRun) {
  console.log("DRY RUN sample:", rows.slice(0, 8));
  const totalStarting = rows.reduce((s, r) => s + r.startingCapital, 0);
  const totalCurrent = rows.reduce((s, r) => s + r.currentCapital, 0);
  console.log(`avg starting capital: ${(totalStarting / rows.length).toFixed(2)}`);
  console.log(`avg current capital: ${(totalCurrent / rows.length).toFixed(2)}`);
  let minCurrent = Infinity;
  let maxCurrent = -Infinity;
  for (const r of rows) {
    if (r.currentCapital < minCurrent) minCurrent = r.currentCapital;
    if (r.currentCapital > maxCurrent) maxCurrent = r.currentCapital;
  }
  console.log(`min current: ${minCurrent.toFixed(2)}, max current: ${maxCurrent.toFixed(2)}`);
  const p95Idx = Math.floor(rows.length * 0.95);
  const sortedCurrent = rows.map((r) => r.currentCapital).sort((a, b) => a - b);
  console.log(`median current: ${sortedCurrent[Math.floor(rows.length / 2)].toFixed(2)}, p95: ${sortedCurrent[p95Idx].toFixed(2)}`);
  await db.end();
  process.exit(0);
}

const CHUNK = 500;
for (let i = 0; i < rows.length; i += CHUNK) {
  const chunk = rows.slice(i, i + CHUNK);
  const values = chunk
    .map(
      (_, j) =>
        `($${j * 5 + 1}::uuid, $${j * 5 + 2}::text, $${j * 5 + 3}::numeric, $${j * 5 + 4}::numeric, $${j * 5 + 5}::timestamptz)`,
    )
    .join(",");
  const params = chunk.flatMap((r) => [r.providerId, r.displayName, r.startingCapital, r.currentCapital, r.joinedAt]);
  await db.query(
    `insert into public.synthetic_customers (provider_id, display_name, starting_capital, current_capital, joined_at)
     values ${values}`,
    params,
  );
  process.stdout.write(`\rinserted ${Math.min(i + CHUNK, rows.length)}/${rows.length}`);
}
console.log("\ndone");
await db.end();
