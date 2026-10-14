-- 0256: professional notification policy
--
-- ON by default (in the app and by email):
--   copy started / stopped, automatic stop at the loss limit, loss alerts, a copied trader that stops
--   trading, identity verification and wallet/account changes, security (new sign-in, password and
--   two-factor changes).
-- OFF by default, opt-in from the notification settings:
--   one notice per opened / closed copied trade ("copy_trades"). When the customer switches it on,
--   a burst of trades of the same trader is merged into ONE notice that counts them ("3 trades opened
--   from X") instead of one notice per trade.
--
-- Existing notifications are kept untouched; the policy applies to new ones only.
-- Rollback: supabase/rollback/0256_notification_policy.sql

begin;

-- ---------------------------------------------------------------- categories

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

create or replace function public.notification_account_type(p_type text, p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when p_type in ('copy_opened', 'copy_closed', 'copy_started', 'copy_stopped', 'auto_stop_copy', 'leader_stopped',
                    'followed_trade_opened', 'followed_trade_closed', 'loss_alert')
      then coalesce((select account_type from public.profiles where id = p_user), 'demo')
    when p_type like 'wallet\_%' then 'real'
    else null
  end
$$;

-- In-app delivery: an explicit "off" always wins; the opt-in category needs an explicit "on".
create or replace function public.notifications_respect_preferences()
returns trigger language plpgsql security definer set search_path = public as $$
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
end $$;

-- Email: same defaults. The per-trade category is off until switched on; followed-trader trade
-- emails stay off by default as before.
create or replace function public.email_category_enabled(p_user uuid, p_category text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when p_category = 'security' then true
    else coalesce(
      (select email from public.notification_preferences where user_id = p_user and category = p_category),
      p_category not in ('trades', 'copy_trades'))
  end
$$;

-- Demo trading stays in the app (no email), now for the per-trade category too.
create or replace function public.email_enqueue(
  p_user uuid, p_kind text, p_category text, p_account_type text, p_data jsonb,
  p_title text default null, p_body text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_category in ('copy', 'copy_trades', 'trades') and coalesce(p_account_type, 'demo') = 'demo' then return; end if;
  if not exists (select 1 from public.profiles where id = p_user and email is not null and email <> '') then return; end if;
  if not public.email_category_enabled(p_user, p_category) then return; end if;
  insert into public.email_outbox (user_id, kind, category, account_type, data, fallback_title, fallback_body)
  values (p_user, p_kind, p_category, p_account_type, coalesce(p_data, '{}'::jsonb), p_title, p_body);
end $$;
revoke all on function public.email_enqueue(uuid, text, text, text, jsonb, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------- merging of per-trade notices
-- Runs BEFORE the email trigger (name sorts first), so a merged notice sends no extra email.
create or replace function public.notifications_aggregate_copy_trades()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_existing record;
  v_account text := coalesce(new.account_type, public.notification_account_type(new.type, new.user_id));
  v_signed numeric;
  v_old_signed numeric;
begin
  -- the automatic stop replaces the plain "copy stopped" notice created a moment earlier
  if new.type = 'auto_stop_copy' then
    delete from public.notifications
    where user_id = new.user_id and type = 'copy_stopped' and created_at > now() - interval '10 seconds';
    return new;
  end if;

  if new.type not in ('copy_opened', 'copy_closed') then
    return new;
  end if;
  -- only merge when the customer receives these notices at all
  if not exists (
    select 1 from public.notification_preferences p
    where p.user_id = new.user_id and p.category = 'copy_trades' and p.in_app = true
  ) then
    return new;
  end if;

  select n.id, n.data into v_existing
  from public.notifications n
  where n.user_id = new.user_id and n.type = new.type and not n.is_read
    and coalesce(n.account_type, v_account) is not distinct from v_account
    and n.data ->> 'providerName' is not distinct from new.data ->> 'providerName'
    and n.created_at > now() - interval '15 minutes'
  order by n.created_at desc
  limit 1;

  if v_existing.id is null then
    new.data := coalesce(new.data, '{}'::jsonb) || jsonb_build_object('count', 1);
    return new;
  end if;

  if new.type = 'copy_closed' then
    v_signed := (case when coalesce((new.data ->> 'positive')::boolean, true) then 1 else -1 end) * coalesce((new.data ->> 'amount')::numeric, 0);
    v_old_signed := (case when coalesce((v_existing.data ->> 'positive')::boolean, true) then 1 else -1 end) * coalesce((v_existing.data ->> 'amount')::numeric, 0);
    update public.notifications
    set data = v_existing.data || jsonb_build_object(
          'count', coalesce((v_existing.data ->> 'count')::int, 1) + 1,
          'amount', round(abs(v_signed + v_old_signed), 2),
          'positive', (v_signed + v_old_signed) >= 0),
        created_at = now()
    where id = v_existing.id;
  else
    update public.notifications
    set data = v_existing.data || jsonb_build_object('count', coalesce((v_existing.data ->> 'count')::int, 1) + 1),
        created_at = now()
    where id = v_existing.id;
  end if;
  return null;
end $$;
drop trigger if exists trg_notifications_00_aggregate on public.notifications;
create trigger trg_notifications_00_aggregate before insert on public.notifications
  for each row execute function public.notifications_aggregate_copy_trades();

-- ---------------------------------------------------------------- copy started / stopped
create or replace function public.notify_follower_subscription_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name text;
begin
  if (tg_op = 'INSERT' and new.is_active) or (tg_op = 'UPDATE' and new.is_active and not old.is_active) then
    select coalesce(pf.display_name, pv.display_name) into v_name
    from public.providers pv left join public.profiles pf on pf.id = pv.user_id where pv.id = new.provider_id;
    insert into public.notifications (user_id, type, title, body, data)
    values (new.follower_id, 'copy_started', 'بدأ النسخ', null,
            jsonb_build_object('providerName', coalesce(v_name, ''), 'amount', new.allocated_amount));
  elsif tg_op = 'UPDATE' and old.is_active and not new.is_active then
    select coalesce(pf.display_name, pv.display_name) into v_name
    from public.providers pv left join public.profiles pf on pf.id = pv.user_id where pv.id = new.provider_id;
    insert into public.notifications (user_id, type, title, body, data)
    values (new.follower_id, 'copy_stopped', 'توقف النسخ', null,
            jsonb_build_object('providerName', coalesce(v_name, '')));
  end if;
  return new;
exception when others then
  return new; -- never block a copy because a notice failed
end $$;
drop trigger if exists trg_notify_follower_subscription_change on public.subscriptions;
create trigger trg_notify_follower_subscription_change
  after insert or update of is_active on public.subscriptions
  for each row execute function public.notify_follower_subscription_change();

-- ---------------------------------------------------------------- a copied trader stops trading
create or replace function public.notify_copiers_leader_stopped()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name text;
begin
  if not ((old.trading_status = 'active' and new.trading_status is distinct from 'active')
          or (not coalesce(old.is_archived, false) and coalesce(new.is_archived, false))) then
    return new;
  end if;
  v_name := coalesce((select pf.display_name from public.profiles pf where pf.id = new.user_id), new.display_name);
  insert into public.notifications (user_id, type, title, body, data)
  select s.follower_id, 'leader_stopped', 'توقف متداول تنسخه', null,
         jsonb_build_object('providerName', coalesce(v_name, ''))
  from public.subscriptions s
  where s.provider_id = new.id and s.is_active;
  return new;
exception when others then
  return new;
end $$;
drop trigger if exists trg_notify_copiers_leader_stopped on public.providers;
create trigger trg_notify_copiers_leader_stopped
  after update of trading_status, is_archived on public.providers
  for each row execute function public.notify_copiers_leader_stopped();

-- ---------------------------------------------------------------- new sign-in
-- A sign-in from an address the account has not used last time. Fires from the profile update the
-- app already performs (record_login), so it follows the same permissions.
create or replace function public.notify_new_sign_in()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.last_login_ip is not null and new.last_login_ip is not null and new.last_login_ip is distinct from old.last_login_ip then
    insert into public.notifications (user_id, type, title, body, data)
    values (new.id, 'security_new_login', 'تسجيل دخول جديد', null,
            jsonb_build_object('country', coalesce(new.country, '')));
  end if;
  return new;
exception when others then
  return new;
end $$;
drop trigger if exists trg_notify_new_sign_in on public.profiles;
create trigger trg_notify_new_sign_in
  after update of last_login_ip on public.profiles
  for each row execute function public.notify_new_sign_in();

commit;
