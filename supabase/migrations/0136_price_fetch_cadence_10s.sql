-- ============================================================
-- Copy Matrix — speed up the price-fetch cadence from 20s to 10s,
-- now that the actual root cause of today's earlier incident is
-- fixed (0135's net._http_response cleanup job -- that table had
-- never been pruned at any cadence). A conservative step, not a
-- return to the 1s change that caused the incident -- watch database
-- health for a few days before considering going faster.
-- ============================================================

select cron.schedule('fire-price-fetch-requests', '10 seconds', $$select public.fire_price_fetch_requests();$$);
select cron.schedule('apply-price-fetch-responses', '10 seconds', $$select public.apply_price_fetch_responses();$$);
