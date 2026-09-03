-- ============================================================
-- Copy Matrix — subscriptions only had a select-own RLS policy, no
-- admin-select policy at all (same recurring gap as wallet_transactions
-- in migration 0082). Found while rebuilding the admin "نشاط النسخ"
-- page to show every client's copy status — without this, the admin
-- query would silently see zero subscriptions for anyone but itself.
-- ============================================================

create policy subscriptions_select_admin
  on public.subscriptions
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin
    )
  );
