-- Rollback for 0255. Restores dashboard_summary to its 0254 definition (without risk_level) is NOT
-- needed: the 0254 file re-creates it. Run supabase/migrations/0254_dashboard_summary_rpc.sql after this
-- script if the dashboard code that reads risk_level is rolled back too (the extra key is harmless).
begin;
do $$ begin
  perform cron.unschedule('refresh-benchmark-cache') where exists (select 1 from cron.job where jobname = 'refresh-benchmark-cache');
  perform cron.unschedule('evaluate-loss-alerts') where exists (select 1 from cron.job where jobname = 'evaluate-loss-alerts');
exception when others then null; end $$;
drop function if exists public.evaluate_loss_alerts();
drop function if exists public.set_loss_alert(uuid, numeric);
drop table if exists public.loss_alert_rules;
drop function if exists public.portfolio_summary(text);
drop function if exists public.benchmark_bundle();
drop function if exists public.refresh_benchmark_cache();
drop table if exists public.benchmark_cache;
-- notification_category / notification_account_type: back to the 0228 / 0241 lists (no 'loss_alert').
create or replace function public.notification_category(p_type text)
returns text language sql immutable as $$
  select case
    when p_type in ('followed_trade_opened', 'followed_trade_closed') then 'trades'
    when p_type in ('copy_opened', 'copy_closed', 'auto_stop_copy') then 'copy'
    when p_type like 'wallet\_%' or p_type like 'kyc\_%' then 'account'
    else 'security'
  end
$$;
create or replace function public.notification_account_type(p_type text, p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when p_type in ('copy_opened', 'copy_closed', 'auto_stop_copy', 'followed_trade_opened', 'followed_trade_closed')
      then coalesce((select account_type from public.profiles where id = p_user), 'demo')
    when p_type like 'wallet\_%' then 'real'
    else null
  end
$$;
commit;
