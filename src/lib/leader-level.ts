// rating_score is 0-100; 20 points per level, clamped to 1-5. Kept out of the
// (client) TraderAvatar component so server pages can call it too.
export function leaderLevel(ratingScore: number | string | null | undefined): number | null {
  if (ratingScore == null) return null;
  const n = Number(ratingScore);
  if (!Number.isFinite(n)) return null;
  return Math.min(5, Math.max(1, Math.ceil(n / 20)));
}
