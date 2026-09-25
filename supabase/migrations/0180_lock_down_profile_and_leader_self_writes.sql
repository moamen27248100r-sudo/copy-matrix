-- Security audit finding (critical): profiles_update_own's RLS policy only
-- checks row ownership ("auth.uid() = id"), and Supabase grants UPDATE on
-- EVERY column of a new table to the authenticated role by default. Combined,
-- any logged-in customer could call the Supabase REST API directly (their
-- own valid JWT + the public anon key, both necessarily client-exposed) and
-- PATCH their own profiles row to set is_admin = true (full admin panel
-- access, including every other user's KYC documents via kyc_docs_select_admin
-- and the impersonation flow), balance to any amount, is_suspended = false,
-- or is_provider/account_type/email to whatever they like -- entirely
-- bypassing every app-level check.
--
-- Every genuinely legitimate direct-client write to profiles only ever
-- touches display_name (settings), or signup_ip/last_login_ip/country/
-- last_seen_at/login_count (record_login()/touch_last_seen() RPCs, and the
-- signup flow -- confirmed these two RPCs are NOT security definer, so they
-- do rely on this grant and must keep it). Every other write -- is_admin,
-- is_suspended, balance, account_type, onboarding_completed, phone -- was
-- migrated in this same change to go through the service-role client
-- (src/app/admin/actions.ts, src/app/settings/actions.ts,
-- src/app/auth/actions.ts), which bypasses grants/RLS entirely, so revoking
-- them here breaks nothing legitimate.
-- Supabase's default table-level "GRANT UPDATE ON profiles TO authenticated"
-- (set up once when the project/table was created) covers every column
-- regardless of any column-level REVOKE, so the blanket grant has to go
-- first -- then re-grant UPDATE only on the columns with a genuine
-- direct-client write path (display_name; signup_ip/last_login_ip/country/
-- last_seen_at/login_count via the two non-security-definer RPCs above).
revoke update on public.profiles from authenticated;
grant update (display_name, signup_ip, last_login_ip, country, last_seen_at, login_count)
  on public.profiles to authenticated;

-- Second finding: providers_insert_own / providers_update_own / signals_insert_own /
-- signals_update_own (all keyed off "user_id = auth.uid()" / a provider owned
-- by the caller) have zero legitimate callers -- there is no "a real customer
-- becomes a leader" feature anywhere in the app; every leader is
-- platform-generated, and the only code that ever writes providers/signals
-- is src/app/admin/actions.ts, gated by assertAdmin() and the separate
-- providers_update_admin/signals_update_admin policies. Left in place, these
-- let any customer INSERT a brand-new "leader" row for themselves (fabricated
-- track record, follower count, minimum copy amount) and get it surfaced on
-- the public discover/homepage pages to solicit real other customers -- a
-- fraud vector, not just self-serving data fabrication. Dropped outright.
-- providers_delete_own dropped too, same reasoning -- one leftover test
-- fixture row currently has providers.user_id set (a "Nav Test" account,
-- clearly a QA artifact, not a real feature in use), so nothing production
-- depends on any of these four.
drop policy if exists providers_insert_own on public.providers;
drop policy if exists providers_update_own on public.providers;
drop policy if exists providers_delete_own on public.providers;
drop policy if exists signals_insert_own on public.signals;
drop policy if exists signals_update_own on public.signals;
