-- Leader performance (win rate, average return, rating/tier, risk level,
-- open/closed trade counts -- everything provider_cards exposes) now updates
-- once a day instead of every minute: stays fixed all day for every leader
-- across the whole platform, then refreshes at 00:00 UTC to reflect the
-- previous UTC day. avg_daily_return_pct already groups trades by UTC
-- calendar date (see provider_performance's definition), so midnight UTC is
-- the natural boundary -- "today's number" cleanly means "as of the most
-- recently completed day".
--
-- The underlying trading simulation (run_market_simulation, every minute) is
-- unaffected and keeps running exactly as before -- this only changes how
-- often the derived, public-facing performance snapshot is recomputed.
-- refresh_provider_performance() itself (added in 0144) is unchanged, only
-- its schedule.

select cron.unschedule('refresh-provider-performance');

select cron.schedule(
  'refresh-provider-performance',
  '0 0 * * *',
  $$select public.refresh_provider_performance();$$
);
