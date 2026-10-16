-- Rollback of 0266: no price alerts. Notifications already sent stay in the customers' lists.
begin;
select cron.unschedule('evaluate-price-alerts');
drop function if exists public.evaluate_price_alerts();
drop function if exists public.cancel_price_alert(uuid);
drop function if exists public.create_price_alert(text, numeric);
drop table if exists public.price_alerts;
commit;
