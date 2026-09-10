// Full reseed: give each leader's base_followers_count padding number
// real per-row identity — a distinct synthetic customer per unit of
// base_followers_count, each with its own name (foreign for foreign
// leaders, mostly Arabic otherwise), starting capital (scaled by the
// leader's own rating_score — better leaders can plausibly have some
// high-capital customers), and join date. current_capital is computed
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

function pickName(providerCountry) {
  if (providerCountry != null || Math.random() < 0.1) {
    const f = CUSTOMER_FIRST_INTL[Math.floor(Math.random() * CUSTOMER_FIRST_INTL.length)];
    const l = CUSTOMER_LAST_INTL[Math.floor(Math.random() * CUSTOMER_LAST_INTL.length)];
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
  `select id, created_at, min_copy_amount, base_followers_count, country from public.providers`,
);
console.log(`${providers.length} providers, total base_followers_count = ${providers.reduce((s, p) => s + p.base_followers_count, 0)}`);

console.log("fetching provider ratings...");
const { rows: ratings } = await db.query(`select provider_id, rating_score from public.provider_cards`);
const ratingByProvider = new Map(ratings.map((r) => [r.provider_id, r.rating_score]));

console.log("fetching closed signals...");
const { rows: signals } = await db.query(
  `select id, provider_id, side, entry_price, exit_price, opened_at, closed_at
   from public.signals
   where status = 'closed' and exit_price is not null
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
  const rating = ratingByProvider.get(p.id) ?? 45; // population median fallback
  const ceiling = 5000 + rating * 700; // rating 0 -> $5,000, rating 79 (observed max) -> $60,300
  const n = p.base_followers_count;

  for (let i = 0; i < n; i++) {
    const joinedAtMs = createdAtMs + Math.random() * (now - createdAtMs);
    const joinedAt = new Date(joinedAtMs);
    const startingCapital = Math.round(logUniform(capFloor, ceiling) * 100) / 100;
    const customerId = crypto.randomUUID();

    // Per-step bound (bounds every step of the walk, not just the end
    // result, so a long sequence of trades can't compound into an
    // absurd outlier) — also doubles as the "ran out of balance"
    // proportional floor for the pause trigger below.
    const floor = startingCapital * 0.1;
    const ceil = startingCapital * 15;

    let balance = startingCapital;
    let copyStatus = "active";
    let openPauseIdx = null;
    let lastCheckAtMs = null; // last time we rolled a resume check while paused

    for (const s of providerSignals) {
      const openedAtMs = new Date(s.opened_at).getTime();
      if (openedAtMs < joinedAtMs) continue;
      const eventAt = s.closed_at ?? s.opened_at;
      const eventAtMs = new Date(eventAt).getTime();

      if (copyStatus === "paused") {
        const gapMinutes = Math.max(0, (eventAtMs - lastCheckAtMs) / 60000);
        const resumeProb = 1 - Math.pow(1 - RESUME_PER_MINUTE_PROB, gapMinutes);
        if (Math.random() < resumeProb) {
          copyStatus = "active";
          balance = Math.max(10, Math.round(startingCapital * (0.3 + Math.random() * 0.5) * 100) / 100);
          pauses[openPauseIdx].resumedAt = eventAt;
          openPauseIdx = null;
        } else {
          lastCheckAtMs = eventAtMs;
          continue; // still paused: this trade does not apply, does not appear in this customer's history
        }
      }

      const raw = (Number(s.exit_price) - Number(s.entry_price)) / Number(s.entry_price);
      const signed = s.side === "sell" ? -raw : raw;
      const pnl = balance * signed;
      balance = Math.min(ceil, Math.max(floor, balance + pnl));

      if (pnl > 0 && Math.random() < WITHDRAWAL_PROB) {
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
        `($${j * 4 + 1}::uuid, $${j * 4 + 2}::uuid, $${j * 4 + 3}::timestamptz, $${j * 4 + 4}::timestamptz)`,
    )
    .join(",");
  const params = chunk.flatMap((pa) => [pa.customerId, pa.providerId, pa.pausedAt, pa.resumedAt]);
  await db.query(
    `insert into public.synthetic_customer_pauses (customer_id, provider_id, paused_at, resumed_at)
     values ${values}`,
    params,
  );
  process.stdout.write(`\rpauses: ${Math.min(i + CHUNK, pauses.length)}/${pauses.length}`);
}
console.log("\ndone");
await db.end();
