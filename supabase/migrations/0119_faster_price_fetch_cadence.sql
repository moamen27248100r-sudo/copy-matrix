-- ============================================================
-- Copy Matrix — the live-price WebSocket push (Realtime) is
-- event-driven and pushes the instant a row changes, so it was never
-- the bottleneck. The actual bottleneck was upstream: prices were
-- only ever fetched from Binance/frankfurter once a minute
-- (fire-price-fetch-requests), with apply-price-fetch-responses just
-- polling every 20s to grab that same once-a-minute result as soon
-- as it landed. Sped both up to every 5 seconds -- the Binance call
-- is one cheap batched ticker/price request for all 6 symbols, well
-- within its public rate limit even at this cadence.
-- ============================================================

select cron.alter_job(jobid, schedule := '5 seconds')
from cron.job
where jobname = 'fire-price-fetch-requests';

select cron.alter_job(jobid, schedule := '5 seconds')
from cron.job
where jobname = 'apply-price-fetch-responses';
