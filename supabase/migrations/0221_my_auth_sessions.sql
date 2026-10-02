-- Active devices & sessions page (/account/sessions).
-- Rollback: supabase/rollback/0221_my_auth_sessions.sql
--
-- supabase-js has no API to list a user's own sessions, so this exposes the
-- caller's rows from auth.sessions (and nobody else's): device user agent,
-- IP, created / last active, and which one is the current session. Read
-- only -- signing out the other sessions goes through
-- supabase.auth.signOut({ scope: "others" }).

create or replace function public.my_auth_sessions()
returns table (id uuid, created_at timestamptz, last_active_at timestamptz, user_agent text, ip text, is_current boolean)
language sql stable security definer set search_path = '' as $$
  select s.id,
    s.created_at,
    coalesce(s.refreshed_at at time zone 'utc', s.updated_at, s.created_at) as last_active_at,
    s.user_agent,
    host(s.ip) as ip,
    s.id::text = coalesce(auth.jwt() ->> 'session_id', '') as is_current
  from auth.sessions s
  where s.user_id = auth.uid()
    and (s.not_after is null or s.not_after > now())
  order by last_active_at desc
$$;

revoke all on function public.my_auth_sessions() from public, anon;
grant execute on function public.my_auth_sessions() to authenticated;
