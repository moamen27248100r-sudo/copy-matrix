-- ============================================================
-- Copy Matrix — the signals table (260K+ rows) only ever had a
-- primary key index on id. provider_id is filtered/joined in
-- essentially every query this app makes against signals (every
-- trader profile, every portfolio, the engine itself), so every one
-- of those has been doing a full table scan this whole project.
--
-- This went from "just slow" to a real incident today: a burst of
-- write load (from briefly running the price-fetch cron every 1s
-- instead of a sane cadence) triggered heavy autovacuum activity,
-- which combined with the missing index to produce query timeouts
-- across the site -- including false "trader not found" 404s
-- wherever a lookup returned null because the query itself failed,
-- not because the row didn't exist.
--
-- Added the missing index (created CONCURRENTLY to avoid locking
-- the table -- it was applied live already once the DB was healthy
-- again, this migration just records it). Also unblocks: the app
-- almost always filters by (provider_id, status) together, so this
-- composite index directly serves that pattern instead of needing a
-- second lookup on status.
-- ============================================================

create index concurrently if not exists signals_provider_id_status_idx
  on public.signals (provider_id, status);
