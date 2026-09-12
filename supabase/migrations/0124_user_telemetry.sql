-- ============================================================
-- Copy Matrix — admin user telemetry: IP at signup/login, country
-- (derived from Vercel's edge geo header, no third-party GeoIP call
-- needed), online status + last-seen (throttled write from
-- middleware, see src/lib/supabase/middleware.ts), and a login
-- counter for the new admin segmentation tabs.
--
-- Applied live as separate statements first (ALTER TABLE, then
-- CREATE INDEX CONCURRENTLY afterwards, since Postgres implicitly
-- wraps a multi-statement simple-query batch in one transaction and
-- CONCURRENTLY can't run inside one) -- this file records both.
-- ============================================================

alter table public.profiles
  add column if not exists signup_ip text,
  add column if not exists last_login_ip text,
  add column if not exists country text,
  add column if not exists last_seen_at timestamptz,
  add column if not exists login_count integer not null default 0;

create index concurrently if not exists profiles_last_seen_idx
  on public.profiles (last_seen_at desc);

-- security invoker (default) + a WHERE clause hardcoded to auth.uid():
-- relies on the existing profiles_update_own RLS policy, no privilege
-- escalation needed -- a signed-in user can only ever touch their own row.
create or replace function public.record_login(p_ip text, p_country text)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.profiles
  set last_login_ip = coalesce(p_ip, last_login_ip),
      country = coalesce(p_country, country),
      last_seen_at = now(),
      login_count = login_count + 1
  where id = auth.uid();
$$;

-- Throttled last_seen_at touch called from middleware on every request --
-- deliberately NOT incrementing login_count (that only happens at an
-- actual login) and NOT overwriting country/last_login_ip (those are only
-- meaningful at signup/login, not on every page view).
create or replace function public.touch_last_seen()
returns void
language sql
security invoker
set search_path = public
as $$
  update public.profiles
  set last_seen_at = now()
  where id = auth.uid();
$$;
