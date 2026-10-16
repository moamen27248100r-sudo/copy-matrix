-- 0268: an optional daily summary of the copies
--
-- Off by default (category 'digest', like one notice per copied trade): once switched on in the
-- notification settings, the customer gets one notice a day (19:00 UTC) for the account they are
-- on: trades of their copies closed in the last 24 hours, their total result, and the copied trades
-- still open. Nothing is sent on a day without any closed or open copied trade. Email follows the
-- same switch (off by default, and never for demo trading, like the other copy emails).
-- Rollback: supabase/rollback/0268_daily_summary.sql

begin;

alter table public.notification_preferences drop constraint if exists notification_preferences_category_check;
alter table public.notification_preferences
  add constraint notification_preferences_category_check
  check (category in ('trades', 'copy', 'copy_trades', 'account', 'market', 'digest'));

CREATE OR REPLACE FUNCTION public.notification_category(p_type text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case
    when p_type in ('copy_opened', 'copy_closed') then 'copy_trades'
    when p_type in ('followed_trade_opened', 'followed_trade_closed') then 'trades'
    when p_type in ('copy_started', 'copy_stopped', 'auto_stop_copy', 'loss_alert', 'leader_stopped', 'copy_reduced', 'copy_skipped') then 'copy'
    when p_type = 'copy_daily_summary' then 'digest'
    when p_type like 'market\_%' then 'market'
    when p_type like 'wallet\_%' or p_type like 'kyc\_%' then 'account'
    else 'security'
  end
$function$;

CREATE OR REPLACE FUNCTION public.notification_account_type(p_type text, p_user uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when p_type in ('copy_opened', 'copy_closed', 'copy_started', 'copy_stopped', 'auto_stop_copy', 'leader_stopped',
                    'followed_trade_opened', 'followed_trade_closed', 'loss_alert',
                    'copy_reduced', 'copy_skipped', 'copy_daily_summary')
      then coalesce((select account_type from public.profiles where id = p_user), 'demo')
    when p_type like 'wallet\_%' then 'real'
    else null
  end
$function$;

CREATE OR REPLACE FUNCTION public.email_category_enabled(p_user uuid, p_category text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when p_category = 'security' then true
    else coalesce(
      (select email from public.notification_preferences where user_id = p_user and category = p_category),
      p_category not in ('trades', 'copy_trades', 'market', 'digest'))
  end
$function$;

CREATE OR REPLACE FUNCTION public.email_enqueue(p_user uuid, p_kind text, p_category text, p_account_type text, p_data jsonb, p_title text DEFAULT NULL::text, p_body text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_category in ('copy', 'copy_trades', 'trades', 'digest') and coalesce(p_account_type, 'demo') = 'demo' then return; end if;
  if not exists (select 1 from public.profiles where id = p_user and email is not null and email <> '') then return; end if;
  if not public.email_category_enabled(p_user, p_category) then return; end if;
  insert into public.email_outbox (user_id, kind, category, account_type, data, fallback_title, fallback_body)
  values (p_user, p_kind, p_category, p_account_type, coalesce(p_data, '{}'::jsonb), p_title, p_body);
end $function$;

CREATE OR REPLACE FUNCTION public.notifications_respect_preferences()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_cat text := public.notification_category(new.type);
begin
  if exists (
    select 1 from public.notification_preferences p
    where p.user_id = new.user_id and p.category = v_cat and p.in_app = false
  ) then
    return null;
  end if;
  if v_cat in ('copy_trades', 'digest') and not exists (
    select 1 from public.notification_preferences p
    where p.user_id = new.user_id and p.category = v_cat and p.in_app = true
  ) then
    return null;
  end if;
  return new;
end $function$;

create or replace function public.generate_daily_summaries()
returns integer language plpgsql security definer set search_path = public as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    with who as (
      select distinct p.user_id from public.notification_preferences p
      where p.category = 'digest' and (p.in_app or p.email)
    ), acct as (
      select w.user_id, coalesce(pr.account_type, 'demo') account_type
      from who w join public.profiles pr on pr.id = w.user_id
    )
    select a.user_id, a.account_type,
      (select count(*) from public.simulated_positions sp
        where sp.follower_id = a.user_id and sp.account_type = a.account_type and sp.status = 'closed' and sp.closed_at > now() - interval '24 hours') closed_count,
      (select coalesce(sum(sp.pnl), 0) from public.simulated_positions sp
        where sp.follower_id = a.user_id and sp.account_type = a.account_type and sp.status = 'closed' and sp.closed_at > now() - interval '24 hours') result,
      (select count(*) from public.simulated_positions sp
        where sp.follower_id = a.user_id and sp.account_type = a.account_type and sp.status = 'open') open_count
    from acct a
  loop
    continue when r.closed_count = 0 and r.open_count = 0;
    insert into public.notifications (user_id, type, title, body, data, account_type)
    values (r.user_id, 'copy_daily_summary', 'ملخص نسخك اليوم', null,
      jsonb_build_object('closed', r.closed_count, 'amount', round(abs(r.result), 2), 'positive', r.result >= 0, 'open', r.open_count),
      r.account_type);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.generate_daily_summaries() from public, anon, authenticated;

select cron.schedule('daily-copy-summary', '0 19 * * *', 'select public.generate_daily_summaries()');

commit;
