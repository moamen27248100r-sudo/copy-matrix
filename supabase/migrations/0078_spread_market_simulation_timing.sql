-- ============================================================
-- Copy Matrix — move run_market_simulation() from a rigid */5 minute
-- batch to every minute. The opening step inside the function (0077)
-- is now gated behind a ~20% per-tick chance specifically so this
-- doesn't multiply total daily trade volume — it spreads the same
-- volume across more, smaller, randomly-timed ticks instead of one
-- batch landing on the same 5 clock-minutes every hour.
-- ============================================================

select cron.alter_job(job_id := 2, schedule := '* * * * *');
