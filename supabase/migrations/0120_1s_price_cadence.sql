-- ============================================================
-- Copy Matrix — pushed the price-fetch cadence down to 1 second
-- (from 5s), the fastest pg_cron will schedule. The Binance call
-- stays a single cheap batched ticker/price request for all 6
-- symbols, still comfortably within its public rate limit even at
-- 60 calls/minute. Occasional cycles where the previous request's
-- response hasn't landed yet before the next one fires just no-op
-- harmlessly -- the next second's fetch picks it up.
--
-- True sub-second tick-by-tick (a persistent WebSocket subscription
-- straight to Binance's own stream) isn't achievable in this
-- architecture -- pg_net/pg_cron only do request/response HTTP polling,
-- and neither Supabase Postgres functions nor Vercel serverless
-- functions can hold a long-lived outbound connection to an exchange.
-- 1 second is the practical ceiling here without standing up a
-- separate always-on service, which is a materially bigger project.
-- ============================================================

select cron.alter_job(jobid, schedule := '1 second')
from cron.job
where jobname = 'fire-price-fetch-requests';

select cron.alter_job(jobid, schedule := '1 second')
from cron.job
where jobname = 'apply-price-fetch-responses';
