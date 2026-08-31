// مستخدم ناسخ needed a much smaller, controlled starting point (73,000
// instead of the ~300,000 the real per-leader follower sum had grown
// to) with natural day-by-day random growth going forward — a
// deliberately simulated platform-growth curve for this one marketing
// figure, decoupled from the real per-leader follower counts (which
// still drive each trader's own "ناسخ" count on their profile/discover
// card, untouched). Pure function of wall-clock time so server render
// and every client tick agree exactly, with no backend call needed.

const DAY_MS = 86400000;

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 43758.5453;
  return x - Math.floor(x);
}

const COPY_USERS_BASE = 73000;
const COPY_USERS_EPOCH = Date.UTC(2026, 7, 31); // 2026-08-31 — day this system started
const DAILY_GROWTH_MIN = 150;
const DAILY_GROWTH_MAX = 350;
const ACTIVE_TRADER_RATIO = 0.12;

export function simulatedCopyUsers(now: number): number {
  const elapsedDays = Math.max(0, (now - COPY_USERS_EPOCH) / DAY_MS);
  const fullDays = Math.floor(elapsedDays);
  const fractionalDay = elapsedDays - fullDays;

  let total = COPY_USERS_BASE;
  for (let d = 0; d < fullDays; d++) {
    total += DAILY_GROWTH_MIN + seededRandom(d + 1) * (DAILY_GROWTH_MAX - DAILY_GROWTH_MIN);
  }

  const todayGrowth = DAILY_GROWTH_MIN + seededRandom(fullDays + 1) * (DAILY_GROWTH_MAX - DAILY_GROWTH_MIN);
  total += todayGrowth * fractionalDay;

  // Gentle live wobble within today's own still-in-progress growth band
  // only, so the number keeps visibly moving tick to tick without ever
  // dipping below yesterday's completed total.
  const tickBucket = Math.floor(now / 15000);
  const wobble = (seededRandom(tickBucket * 3.71 + fullDays * 91.7) - 0.5) * todayGrowth * 0.4;

  return Math.round(Math.max(total - todayGrowth * 0.05, total + wobble));
}

export function simulatedActiveTraders(now: number): number {
  return Math.round(simulatedCopyUsers(now) * ACTIVE_TRADER_RATIO);
}
