// مستخدم ناسخ / متداول نشط are a deliberately simulated marketing
// figure, decoupled from the real per-leader follower sum (which still
// drives each trader's own "ناسخ" count on their profile/discover card,
// untouched). Modeled as a genuine day-to-day random walk — some days
// net up, some days net down, same as real active-user/copier counts —
// not a monotonic always-climbing curve and not capped at any fixed
// ceiling. Pure function of wall-clock time so server render and every
// client tick agree exactly, with no backend call needed.
//
// إجمالي الصفقات المنفذة (total trade count) is intentionally NOT part
// of this file — it's a real, DB-backed lifetime counter (see
// homepage_platform_stats() / LiveHomeStats.tsx) that only ever grows,
// because real executed trades can't be un-executed.

const DAY_MS = 86400000;

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 43758.5453;
  return x - Math.floor(x);
}

const COPY_USERS_BASE = 73000;
const COPY_USERS_EPOCH = Date.UTC(2026, 7, 31); // 2026-08-31 — day this system started
// Asymmetric so the platform still trends gently upward over the long
// run (real growing platforms do), while plenty of individual days net
// negative — a true random walk, not one-directional growth.
const DAILY_DELTA_MIN = -220;
const DAILY_DELTA_MAX = 350;
const ACTIVE_TRADER_RATIO = 0.12;

function dailyDelta(dayIndex: number): number {
  return DAILY_DELTA_MIN + seededRandom(dayIndex) * (DAILY_DELTA_MAX - DAILY_DELTA_MIN);
}

export function simulatedCopyUsers(now: number): number {
  const elapsedDays = Math.max(0, (now - COPY_USERS_EPOCH) / DAY_MS);
  const fullDays = Math.floor(elapsedDays);
  const fractionalDay = elapsedDays - fullDays;

  let total = COPY_USERS_BASE;
  for (let d = 1; d <= fullDays; d++) {
    total += dailyDelta(d);
  }

  const todayDelta = dailyDelta(fullDays + 1);
  total += todayDelta * fractionalDay;

  // Live wobble within today's still-in-progress swing, free to move
  // either direction (no floor pinned to yesterday's total).
  const tickBucket = Math.floor(now / 15000);
  const wobble = (seededRandom(tickBucket * 3.71 + fullDays * 91.7) - 0.5) * Math.abs(todayDelta) * 0.6;

  return Math.max(0, Math.round(total + wobble));
}

export function simulatedActiveTraders(now: number): number {
  return Math.round(simulatedCopyUsers(now) * ACTIVE_TRADER_RATIO);
}
