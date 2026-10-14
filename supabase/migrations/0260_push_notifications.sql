-- 0260: Web Push (mobile / desktop notifications)
--
--   push_subscriptions  one row per device a customer allowed notifications on (own rows readable
--                       and deletable by the customer; written only by the server);
--   push_outbox         one row per delivered notification that has to be pushed (filled by a trigger
--                       on notifications, AFTER the preference triggers: a notice the customer switched
--                       off in the app is never pushed either);
--   fire_push_dispatch  called every minute by pg_cron while the queue has work, calls the app route
--                       /api/cron/push (derived from the Vault secret email_cron_url, or push_cron_url).
-- Sending itself happens in the app and only when the VAPID keys exist in its environment.
-- Rollback: supabase/rollback/0260_push_notifications.sql

begin;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  locale text,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
create policy push_subscriptions_select_own on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
drop policy if exists push_subscriptions_delete_own on public.push_subscriptions;
create policy push_subscriptions_delete_own on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());
revoke all on public.push_subscriptions from anon, authenticated;
grant select (id, user_id, endpoint, created_at, last_seen_at, user_agent) on public.push_subscriptions to authenticated;
grant delete on public.push_subscriptions to authenticated;

create table if not exists public.push_outbox (
  id bigint generated always as identity primary key,
  notification_id uuid,
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  data jsonb,
  fallback_title text,
  fallback_body text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  attempts integer not null default 0,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists push_outbox_pending_idx on public.push_outbox (id) where status = 'pending';
alter table public.push_outbox enable row level security;
revoke all on public.push_outbox from anon, authenticated;

create or replace function public.notifications_push_outbox()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.push_subscriptions where user_id = new.user_id) then
    insert into public.push_outbox (notification_id, user_id, type, data, fallback_title, fallback_body)
    values (new.id, new.user_id, new.type, new.data, new.title, new.body);
  end if;
  return null;
exception when others then
  return null; -- a push problem must never block a notification
end $$;
drop trigger if exists trg_notifications_push_outbox on public.notifications;
create trigger trg_notifications_push_outbox after insert on public.notifications
  for each row execute function public.notifications_push_outbox();

create or replace function public.fire_push_dispatch()
returns void language plpgsql security definer set search_path = public as $$
declare v_url text; v_secret text;
begin
  delete from public.push_outbox where created_at < now() - interval '3 days';
  if not exists (select 1 from public.push_outbox where status = 'pending') then
    return;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'push_cron_url';
  if v_url is null then
    select replace(decrypted_secret, '/api/cron/emails', '/api/cron/push') into v_url
    from vault.decrypted_secrets where name = 'email_cron_url';
  end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'crypto_cron_secret';
  if v_url is null or v_secret is null then return; end if;
  perform net.http_get(url := v_url, headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 55000);
end $$;
revoke all on function public.fire_push_dispatch() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule('push-dispatch');
exception when others then null;
end $$;
select cron.schedule('push-dispatch', '* * * * *', 'select public.fire_push_dispatch()');

commit;
