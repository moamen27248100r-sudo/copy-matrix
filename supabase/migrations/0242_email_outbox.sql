-- Transactional emails.
--
-- Every notification (and a few security events that have no in-app notice)
-- is queued in email_outbox; /api/cron/emails renders it in the customer's
-- language and sends it over SMTP (SUPPORT_EMAIL_*). Nothing is queued for
-- demo-account trading, as on trading platforms' demo modes.
--
-- * profiles.locale: the customer's language (set at sign-up from the
--   locale in the auth metadata, and whenever they switch language).
-- * notification_preferences.email: per-category email switch; when there is
--   no row, copies and account emails are on and followed-leader trade
--   emails are off. Security emails can't be turned off.
-- * The queue is picked up every minute (pg_cron + pg_net), calling the URL
--   in Vault secret `email_cron_url` with the `crypto_cron_secret` bearer.

begin;

-- ---------------------------------------------------------------- locale

alter table public.profiles add column if not exists locale text not null default 'ar';
alter table public.profiles drop constraint if exists profiles_locale_check;
alter table public.profiles add constraint profiles_locale_check
  check (locale in ('ar', 'en', 'fr', 'es', 'pt', 'zh', 'hi', 'ur', 'id', 'vi', 'th', 'bn', 'sw'));

create or replace function public.profiles_set_locale()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v text;
begin
  select raw_user_meta_data ->> 'locale' into v from auth.users where id = new.id;
  if v in ('ar', 'en', 'fr', 'es', 'pt', 'zh', 'hi', 'ur', 'id', 'vi', 'th', 'bn', 'sw') then
    new.locale := v;
  end if;
  return new;
end $$;
drop trigger if exists trg_profiles_set_locale on public.profiles;
create trigger trg_profiles_set_locale before insert on public.profiles
  for each row execute function public.profiles_set_locale();

-- ---------------------------------------------------------------- preferences

alter table public.notification_preferences add column if not exists email boolean;
alter table public.notification_preferences alter column in_app set default true;

create or replace function public.email_category_enabled(p_user uuid, p_category text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when p_category = 'security' then true
    else coalesce(
      (select email from public.notification_preferences where user_id = p_user and category = p_category),
      p_category <> 'trades')
  end
$$;

-- ---------------------------------------------------------------- outbox

create table if not exists public.email_outbox (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  category text not null,
  account_type text,
  data jsonb not null default '{}'::jsonb,
  fallback_title text,
  fallback_body text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'skipped', 'failed')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists email_outbox_pending_idx on public.email_outbox (created_at) where status = 'pending';
alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from anon, authenticated;

create or replace function public.email_enqueue(
  p_user uuid, p_kind text, p_category text, p_account_type text, p_data jsonb,
  p_title text default null, p_body text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  -- Demo trading stays in the app; no address, no email.
  if p_category in ('copy', 'trades') and coalesce(p_account_type, 'demo') = 'demo' then return; end if;
  if not exists (select 1 from public.profiles where id = p_user and email is not null and email <> '') then return; end if;
  if not public.email_category_enabled(p_user, p_category) then return; end if;
  insert into public.email_outbox (user_id, kind, category, account_type, data, fallback_title, fallback_body)
  values (p_user, p_kind, p_category, p_account_type, coalesce(p_data, '{}'::jsonb), p_title, p_body);
end $$;
revoke all on function public.email_enqueue(uuid, text, text, text, jsonb, text, text) from public, anon, authenticated;

-- Runs before notifications_respect_preferences, so an email still goes out
-- when the in-app notice for that category is switched off.
create or replace function public.notifications_email_outbox()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.email_enqueue(new.user_id, new.type, public.notification_category(new.type),
    coalesce(new.account_type, public.notification_account_type(new.type, new.user_id)), new.data, new.title, new.body);
  return new;
end $$;
drop trigger if exists trg_notifications_email_outbox on public.notifications;
create trigger trg_notifications_email_outbox before insert on public.notifications
  for each row execute function public.notifications_email_outbox();

-- Password / two-factor changes (account_security_events) and withdrawal
-- requests have no in-app notice of their own: emailed as security alerts.
create or replace function public.security_events_email()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.password_changed_at is not null
     and (tg_op = 'INSERT' or new.password_changed_at is distinct from old.password_changed_at) then
    perform public.email_enqueue(new.user_id, 'security_password_changed', 'security', null, '{}'::jsonb);
  end if;
  if new.mfa_changed_at is not null
     and (tg_op = 'INSERT' or new.mfa_changed_at is distinct from old.mfa_changed_at) then
    perform public.email_enqueue(new.user_id, 'security_mfa_changed', 'security', null, '{}'::jsonb);
  end if;
  return null;
end $$;
drop trigger if exists trg_security_events_email on public.account_security_events;
create trigger trg_security_events_email after insert or update on public.account_security_events
  for each row execute function public.security_events_email();

create or replace function public.crypto_withdrawal_email()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.email_enqueue(new.user_id, 'security_withdrawal_requested', 'security', 'real',
    jsonb_build_object('amount', new.amount, 'network', new.network,
                       'address', left(new.address, 6) || '…' || right(new.address, 4)));
  return null;
end $$;
drop trigger if exists trg_crypto_withdrawal_email on public.crypto_withdrawals;
create trigger trg_crypto_withdrawal_email after insert on public.crypto_withdrawals
  for each row execute function public.crypto_withdrawal_email();

-- ---------------------------------------------------------------- dispatch

create or replace function public.fire_email_dispatch()
returns void language plpgsql security definer set search_path = public as $$
declare v_url text; v_secret text;
begin
  if not exists (select 1 from public.email_outbox where status = 'pending') then
    return;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'email_cron_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'crypto_cron_secret';
  if v_url is null or v_secret is null then return; end if;
  perform net.http_get(url := v_url, headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 55000);
end $$;
revoke all on function public.fire_email_dispatch() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'email-dispatch';
select cron.schedule('email-dispatch', '* * * * *', $$select public.fire_email_dispatch();$$);

commit;
