-- Rollback of 0259: markets.
begin;

do $$ begin perform cron.unschedule('market-alerts'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('market-alert-log-prune'); exception when others then null; end $$;

drop function if exists public.generate_market_alerts();
drop function if exists public.prune_market_alert_log();
drop function if exists public.market_move_threshold(text);
drop function if exists public.market_snapshot();
drop function if exists public.market_series(text, integer);
drop function if exists public.top_leaders_for_symbol(text, integer);
drop table if exists public.market_alert_log;
drop table if exists public.market_watchlist;

delete from public.notification_preferences where category = 'market';
alter table public.notification_preferences drop constraint if exists notification_preferences_category_check;
alter table public.notification_preferences
  add constraint notification_preferences_category_check
  check (category in ('trades', 'copy', 'copy_trades', 'account'));

create or replace function public.notification_category(p_type text)
returns text language sql immutable as $$
  select case
    when p_type in ('copy_opened', 'copy_closed') then 'copy_trades'
    when p_type in ('followed_trade_opened', 'followed_trade_closed') then 'trades'
    when p_type in ('copy_started', 'copy_stopped', 'auto_stop_copy', 'loss_alert', 'leader_stopped') then 'copy'
    when p_type like 'wallet\_%' or p_type like 'kyc\_%' then 'account'
    else 'security'
  end
$$;

create or replace function public.email_category_enabled(p_user uuid, p_category text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when p_category = 'security' then true
    else coalesce(
      (select email from public.notification_preferences where user_id = p_user and category = p_category),
      p_category not in ('trades', 'copy_trades'))
  end
$$;

commit;
