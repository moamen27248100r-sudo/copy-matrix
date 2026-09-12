-- ============================================================
-- Copy Matrix — closing the same gap that caused today's outage
-- (missing index on signals(provider_id, status)), but platform-wide
-- this time. Confirmed by reading every query against these four
-- tables: simulated_positions, subscriptions, wallet_transactions,
-- and kyc_submissions had ZERO indexes beyond their primary key,
-- despite simulated_positions/subscriptions sitting on the two
-- hottest paths in the entire engine:
--
--   * mirror_signal_to_followers() (fires on every signal OPEN,
--     every engine tick, every provider) does
--     "subscriptions where provider_id = X and is_active = true"
--   * close_simulated_positions() (fires on every signal CLOSE) does
--     "simulated_positions where signal_id = X and status = 'open'"
--     and, for the drawdown check,
--     "simulated_positions where subscription_id = X and status = 'closed'"
--
-- Both were doing full table scans against simulated_positions,
-- which is the single highest-write real-customer-facing table on
-- the platform. This is the same shape of risk that produced today's
-- incident, just not yet triggered by a load spike. Adding these
-- BEFORE any feature work that increases write/read volume on these
-- tables (the newly-requested "position density" mechanic will do
-- exactly that), per the explicit lesson from today.
--
-- All CONCURRENTLY so nothing locks the table while building.
-- ============================================================

create index concurrently if not exists simulated_positions_signal_status_idx
  on public.simulated_positions (signal_id, status);

create index concurrently if not exists simulated_positions_subscription_status_idx
  on public.simulated_positions (subscription_id, status);

create index concurrently if not exists simulated_positions_follower_status_idx
  on public.simulated_positions (follower_id, status);

create index concurrently if not exists subscriptions_provider_active_idx
  on public.subscriptions (provider_id, is_active);

create index concurrently if not exists subscriptions_follower_active_idx
  on public.subscriptions (follower_id, is_active);

create index concurrently if not exists wallet_transactions_user_created_idx
  on public.wallet_transactions (user_id, created_at desc);

create index concurrently if not exists kyc_submissions_user_idx
  on public.kyc_submissions (user_id);
