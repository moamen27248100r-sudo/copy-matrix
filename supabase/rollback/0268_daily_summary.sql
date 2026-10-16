-- Rollback of 0268: no daily summary. Notices already sent stay; saved 'digest' choices are removed.
begin;

select cron.unschedule('daily-copy-summary');
drop function if exists public.generate_daily_summaries();

CREATE OR REPLACE FUNCTION public.notification_category(p_type text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case
    when p_type in ('copy_opened', 'copy_closed') then 'copy_trades'
    when p_type in ('followed_trade_opened', 'followed_trade_closed') then 'trades'
    when p_type in ('copy_started', 'copy_stopped', 'auto_stop_copy', 'loss_alert', 'leader_stopped', 'copy_reduced', 'copy_skipped') then 'copy'
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
                    'copy_reduced', 'copy_skipped')
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
      p_category not in ('trades', 'copy_trades', 'market'))
  end
$function$;

CREATE OR REPLACE FUNCTION public.email_enqueue(p_user uuid, p_kind text, p_category text, p_account_type text, p_data jsonb, p_title text DEFAULT NULL::text, p_body text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_category in ('copy', 'copy_trades', 'trades') and coalesce(p_account_type, 'demo') = 'demo' then return; end if;
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
  if v_cat = 'copy_trades' and not exists (
    select 1 from public.notification_preferences p
    where p.user_id = new.user_id and p.category = v_cat and p.in_app = true
  ) then
    return null;
  end if;
  return new;
end $function$;

delete from public.notification_preferences where category = 'digest';
alter table public.notification_preferences drop constraint if exists notification_preferences_category_check;
alter table public.notification_preferences
  add constraint notification_preferences_category_check
  check (category in ('trades', 'copy', 'copy_trades', 'account', 'market'));

commit;
