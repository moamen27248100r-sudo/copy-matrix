-- ============================================================
-- Copy Matrix — wallet_transactions only had a select-own RLS policy,
-- with no admin-select policy at all (unlike kyc_submissions and
-- wallet_requests, which already have one). Found while building the
-- admin users page's "has deposited" filter: an admin querying other
-- users' wallet_transactions would silently get zero rows back.
-- ============================================================

create policy wallet_transactions_select_admin
  on public.wallet_transactions
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin
    )
  );
