-- Database-level enforcement of two-factor authentication (aal2).
-- Rollback: supabase/rollback/0224_mfa_aal2_rls.sql
--
-- The proxy already holds every page until a 2FA user's session reaches
-- aal2, but the browser holds the aal1 access token too and could call the
-- Data API directly. This closes that path in the database itself:
--
--   * RESTRICTIVE policy `mfa_aal2_required` on every table holding user
--     data (plus storage.objects, i.e. KYC documents), following Supabase's
--     MFA docs: a user with a verified factor must present an aal2 JWT; a
--     user without 2FA is unaffected. TO authenticated only -- anon (public
--     pages) and service_role / postgres (server code, cron, SECURITY
--     DEFINER internals) never evaluate it.
--   * PostgREST pre-request hook applying the same rule to /rpc/* calls,
--     since the user-facing RPCs are SECURITY DEFINER and bypass RLS.
--   * impersonation_sessions: service-role-only list of the admin "view as
--     user" sessions (magic-link, so only ever aal1) that are allowed
--     through. Admins can only start one from their own aal2 session.

create table public.impersonation_sessions (
  session_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  admin_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
alter table public.impersonation_sessions enable row level security;
revoke all on public.impersonation_sessions from anon, authenticated;

-- True when the caller's session satisfies the 2FA rule. SECURITY DEFINER
-- so it can read auth.mfa_factors (no grant to authenticated) and the
-- impersonation list; it only ever looks at the caller's own rows.
create or replace function public.session_mfa_ok()
returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    or not exists (
      select 1 from auth.mfa_factors f
      where f.user_id = auth.uid() and f.status = 'verified'
    )
    or exists (
      select 1 from public.impersonation_sessions s
      where s.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
        and s.user_id = auth.uid()
        and s.expires_at > now()
    )
$$;

revoke all on function public.session_mfa_ok() from public, anon;
grant execute on function public.session_mfa_ok() to authenticated, service_role;

-- `(select fn())` makes Postgres evaluate the check once per statement
-- (initplan) instead of once per row -- on signals (~350k rows) that is
-- 0.2s vs ~10s. profiles is the exception: profiles_update_admin subqueries
-- profiles itself, and a sublink in profiles' own policies turns that nested
-- read into "infinite recursion detected in policy". profiles is small, so
-- the plain per-row call costs little there.
create policy mfa_aal2_required on public.profiles as restrictive for all to authenticated
  using (public.session_mfa_ok()) with check (public.session_mfa_ok());

do $$
declare
  t text;
  user_tables text[] := array[
    'follows', 'subscriptions', 'providers', 'signals', 'simulated_positions',
    'notifications', 'kyc_submissions', 'wallet_requests', 'wallet_transactions',
    'follower_invites', 'lead_trader_profiles', 'lead_trader_applications',
    'lead_trader_announcements', 'lead_trader_follower_removals', 'lead_trader_payout_requests',
    'profit_share_ledger', 'trader_posts', 'admin_audit_log', 'trade_audit_log',
    'trade_integrity_reports',
    '_bak_20260930_lead_trader_announcements', '_bak_20260930_lead_trader_profiles',
    '_bak_20261001_signals', '_bak_20261001_simulated_positions', '_bak_20261001b_profiles_balance',
    '_bak_20261001b_providers_profit', '_bak_20261001b_signals', '_bak_20261001b_simulated_positions',
    '_bak_20261001c_signals_no_lot'
  ];
begin
  foreach t in array user_tables loop
    execute format(
      'create policy mfa_aal2_required on public.%I as restrictive for all to authenticated
         using ((select public.session_mfa_ok())) with check ((select public.session_mfa_ok()))',
      t
    );
  end loop;
end $$;

create policy mfa_aal2_required on storage.objects as restrictive for all to authenticated
  using ((select public.session_mfa_ok())) with check ((select public.session_mfa_ok()));

-- Runs before every Data API request. Only signed-in /rpc/ calls are
-- checked; check_rate_limit and session_mfa_ok stay open because the 2FA
-- sign-in step itself needs them while the session is still aal1.
create or replace function public.mfa_pre_request()
returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  v_path text := current_setting('request.path', true);
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'authenticated' then
    return;
  end if;
  if v_path is null or v_path not like '/rpc/%' or v_path in ('/rpc/check_rate_limit', '/rpc/session_mfa_ok') then
    return;
  end if;
  if not public.session_mfa_ok() then
    raise exception 'mfa_aal2_required'
      using errcode = '42501', hint = 'Complete two-factor verification (aal2) first.';
  end if;
end;
$$;

revoke all on function public.mfa_pre_request() from public;
grant execute on function public.mfa_pre_request() to anon, authenticated, service_role;

alter role authenticator set pgrst.db_pre_request = 'public.mfa_pre_request';
notify pgrst, 'reload config';
