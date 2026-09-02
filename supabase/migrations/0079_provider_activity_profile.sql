-- ============================================================
-- Copy Matrix — give each provider a persistent personality instead of
-- every provider having statistically-identical trade frequency and
-- being equally likely to trade at any hour:
--   - activity_weight: a multiplier used when the engine picks which
--     providers open a trade this tick. >1 = opens trades often,
--     <1 = a quiet trader who only opens a couple of simple trades a
--     day. Values assigned once by scripts/assign-provider-activity-profile.mjs.
--   - session_start_hour / session_end_hour (UTC, 0-23): when set, this
--     provider only opens trades while the current hour falls in that
--     window (wraps past midnight if start > end). null on both means
--     "trades around the clock" (most providers).
-- ============================================================

alter table public.providers
  add column if not exists activity_weight numeric default 1.0,
  add column if not exists session_start_hour smallint,
  add column if not exists session_end_hour smallint;
