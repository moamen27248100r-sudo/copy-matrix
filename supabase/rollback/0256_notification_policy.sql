-- Rollback for 0256: back to the 0228 / 0242 / 0255 definitions. Notifications already created stay.
begin;
drop trigger if exists trg_notifications_00_aggregate on public.notifications;
drop function if exists public.notifications_aggregate_copy_trades();
drop trigger if exists trg_notify_follower_subscription_change on public.subscriptions;
drop function if exists public.notify_follower_subscription_change();
drop trigger if exists trg_notify_copiers_leader_stopped on public.providers;
drop function if exists public.notify_copiers_leader_stopped();
drop trigger if exists trg_notify_new_sign_in on public.profiles;
drop function if exists public.notify_new_sign_in();

delete from public.notification_preferences where category = 'copy_trades';
alter table public.notification_preferences drop constraint if exists notification_preferences_category_check;
alter table public.notification_preferences
  add constraint notification_preferences_category_check check (category in ('trades', 'copy', 'account'));

create or replace function public.notification_category(p_type text)
returns text language sql immutable as $$
  select case
    when p_type in ('followed_trade_opened', 'followed_trade_closed') then 'trades'
    when p_type in ('copy_opened', 'copy_closed', 'auto_stop_copy', 'loss_alert') then 'copy'
    when p_type like 'wallet\_%' or p_type like 'kyc\_%' then 'account'
    else 'security'
  end
$$;

create or replace function public.notification_account_type(p_type text, p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when p_type in ('copy_opened', 'copy_closed', 'auto_stop_copy', 'followed_trade_opened', 'followed_trade_closed', 'loss_alert')
      then coalesce((select account_type from public.profiles where id = p_user), 'demo')
    when p_type like 'wallet\_%' then 'real'
    else null
  end
$$;

create or replace function public.notifications_respect_preferences()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.notification_preferences p
    where p.user_id = new.user_id
      and p.category = public.notification_category(new.type)
      and p.in_app = false
  ) then
    return null;
  end if;
  return new;
end $$;

create or replace function public.email_category_enabled(p_user uuid, p_category text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when p_category = 'security' then true
    else coalesce(
      (select email from public.notification_preferences where user_id = p_user and category = p_category),
      p_category <> 'trades')
  end
$$;

create or replace function public.email_enqueue(
  p_user uuid, p_kind text, p_category text, p_account_type text, p_data jsonb,
  p_title text default null, p_body text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_category in ('copy', 'trades') and coalesce(p_account_type, 'demo') = 'demo' then return; end if;
  if not exists (select 1 from public.profiles where id = p_user and email is not null and email <> '') then return; end if;
  if not public.email_category_enabled(p_user, p_category) then return; end if;
  insert into public.email_outbox (user_id, kind, category, account_type, data, fallback_title, fallback_body)
  values (p_user, p_kind, p_category, p_account_type, coalesce(p_data, '{}'::jsonb), p_title, p_body);
end $$;
revoke all on function public.email_enqueue(uuid, text, text, text, jsonb, text, text) from public, anon, authenticated;
commit;
