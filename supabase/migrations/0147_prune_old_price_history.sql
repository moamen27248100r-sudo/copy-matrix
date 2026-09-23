-- price_history stores raw price ticks the live engine uses to price signals
-- (entry/exit lookups), and every one of those lookups only ever looks
-- forward from a signal's own opened_at, or back a few minutes/hours -- never
-- more than the oldest still-open signal needs (currently ~13 days). Nothing
-- in the application code (src/) reads this table at all -- it is purely an
-- internal engine input, never shown to a customer. The table had grown to
-- ~2.6M rows / 297MB since a 2022 historical backfill, a large share of the
-- database's free-tier size limit.
--
-- Prunes to a 30-day window (more than double the real ~13-day need) and
-- keeps it pruned with a daily cleanup job, same pattern as the
-- cron.job_run_details and net._http_response cleanups.

delete from public.price_history where ts < now() - interval '30 days';

create or replace function public.cleanup_old_price_history()
returns void
language sql
as $$
  delete from public.price_history where ts < now() - interval '30 days';
$$;

select cron.schedule(
  'cleanup-old-price-history',
  '0 3 * * *',
  $$select public.cleanup_old_price_history();$$
);
