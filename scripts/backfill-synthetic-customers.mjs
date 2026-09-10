// Full reseed: give each leader's base_followers_count padding number
// real per-row identity — a distinct synthetic customer per unit of
// base_followers_count, each with its own name, starting capital, and
// join date. current_capital is computed by walking that leader's REAL
// historical closed trades step-by-step from the customer's own join
// date forward (matching how real copy-trading only mirrors NEW
// signals after a follower joins), interleaving a withdrawal roll at
// each winning step (3% chance, 10-40% of that trade's gain) so
// current_capital reconciles exactly with the generated withdrawal
// history in public.synthetic_customer_withdrawals. Purely decorative/
// synthetic — not tied to real profiles/subscriptions in any way.
//
// This DELETES and regenerates all existing synthetic_customers rows
// (cascades to synthetic_customer_withdrawals) — safe because nothing
// else references these ids yet.
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
  `select id, provider_id, side, entry_price, exit_price, opened_at, closed_at
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

const WITHDRAWAL_PROB = 0.03;
const WITHDRAWAL_MIN_FRAC = 0.10;
const WITHDRAWAL_MAX_FRAC = 0.30;

const now = Date.now();
const customers = [];
const withdrawals = [];

for (const p of providers) {
  const createdAtMs = new Date(p.created_at).getTime();
  const providerSignals = signalsByProvider.get(p.id) ?? [];
  const capFloor = Math.max(Number(p.min_copy_amount) || 25, 25);
  const n = p.base_followers_count;

  for (let i = 0; i < n; i++) {
    const joinedAtMs = createdAtMs + Math.random() * (now - createdAtMs);
    const joinedAt = new Date(joinedAtMs);
    const startingCapital = Math.round(logUniform(capFloor, 50000) * 100) / 100;
    const customerId = crypto.randomUUID();

    // Per-step bound (replaces the old final-factor clamp) — bounds
    // every step of the walk, not just the end result, so a long
    // sequence of trades can't compound into an absurd outlier.
    const floor = startingCapital * 0.1;
    const ceil = startingCapital * 15;

    let balance = startingCapital;
    for (const s of providerSignals) {
      if (new Date(s.opened_at).getTime() < joinedAtMs) continue;
      const raw = (Number(s.exit_price) - Number(s.entry_price)) / Number(s.entry_price);
      const signed = s.side === "sell" ? -raw : raw;
      const pnl = balance * signed;
      balance = Math.min(ceil, Math.max(floor, balance + pnl));

      if (pnl > 0 && Math.random() < WITHDRAWAL_PROB) {
        const amount =
          Math.round(pnl * (WITHDRAWAL_MIN_FRAC + Math.random() * (WITHDRAWAL_MAX_FRAC - WITHDRAWAL_MIN_FRAC)) * 100) / 100;
        // A tiny pnl on a tiny balance can round to exactly 0.00 — skip
        // those, an "amount > 0" check constraint rejects zero rows.
        if (amount > 0) {
          balance = Math.max(10, balance - amount);
          withdrawals.push({
            customerId,
            providerId: p.id,
            signalId: s.id,
            amount,
            occurredAt: s.closed_at ?? s.opened_at,
          });
        }
      }
    }

    const currentCapital = Math.max(10, Math.round(balance * 100) / 100);

    customers.push({
      id: customerId,
      providerId: p.id,
      displayName: pickName(),
      startingCapital,
      currentCapital,
      joinedAt: joinedAt.toISOString(),
    });
  }
}

console.log(`prepared ${customers.length} synthetic customers, ${withdrawals.length} withdrawal events`);

if (dryRun) {
  console.log("DRY RUN customer sample:", customers.slice(0, 5));
  console.log("DRY RUN withdrawal sample:", withdrawals.slice(0, 5));
  const totalStarting = customers.reduce((s, r) => s + r.startingCapital, 0);
  const totalCurrent = customers.reduce((s, r) => s + r.currentCapital, 0);
  console.log(`avg starting capital: ${(totalStarting / customers.length).toFixed(2)}`);
  console.log(`avg current capital: ${(totalCurrent / customers.length).toFixed(2)}`);
  let minCurrent = Infinity;
  let maxCurrent = -Infinity;
  for (const r of customers) {
    if (r.currentCapital < minCurrent) minCurrent = r.currentCapital;
    if (r.currentCapital > maxCurrent) maxCurrent = r.currentCapital;
  }
  console.log(`min current: ${minCurrent.toFixed(2)}, max current: ${maxCurrent.toFixed(2)}`);
  console.log(`avg withdrawals per customer: ${(withdrawals.length / customers.length).toFixed(3)}`);
  await db.end();
  process.exit(0);
}

console.log("deleting existing synthetic_customers (cascades to withdrawals)...");
await db.query(`delete from public.synthetic_customers`);

const CHUNK = 500;
for (let i = 0; i < customers.length; i += CHUNK) {
  const chunk = customers.slice(i, i + CHUNK);
  const values = chunk
    .map(
      (_, j) =>
        `($${j * 6 + 1}::uuid, $${j * 6 + 2}::uuid, $${j * 6 + 3}::text, $${j * 6 + 4}::numeric, $${j * 6 + 5}::numeric, $${j * 6 + 6}::timestamptz)`,
    )
    .join(",");
  const params = chunk.flatMap((r) => [r.id, r.providerId, r.displayName, r.startingCapital, r.currentCapital, r.joinedAt]);
  await db.query(
    `insert into public.synthetic_customers (id, provider_id, display_name, starting_capital, current_capital, joined_at)
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
console.log("\ndone");
await db.end();
