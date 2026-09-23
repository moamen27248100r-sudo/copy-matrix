-- cron.job_run_details is pg_cron's own execution log (one row per run of
-- every scheduled job) -- pure debug history, no functional value, and
-- nothing in this app reads it. With several jobs on a 10-second cadence it
-- had grown to ~94MB / ~508k rows over ~7 weeks, a large share of the
-- database's 500MB free-tier ceiling. Trimmed here and kept trimmed by the
-- same recurring-cleanup pattern already used for net._http_response
-- (0110-ish "cleanup-http-responses"): short retention (6h -- long enough to
-- debug a job that broke a few hours ago), pruned every 30 minutes.

delete from cron.job_run_details where start_time < now() - interval '6 hours';

create or replace function public.cleanup_cron_job_run_details()
returns void
language sql
as $$
  delete from cron.job_run_details where start_time < now() - interval '6 hours';
$$;

select cron.schedule(
  'cleanup-cron-job-run-details',
  '*/30 * * * *',
  $$select public.cleanup_cron_job_run_details();$$
);
