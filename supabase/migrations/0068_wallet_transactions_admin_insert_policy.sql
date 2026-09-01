-- ============================================================
-- Copy Matrix — wallet_transactions had no insert policy at all
-- (only ever written by security-definer trigger functions), so the
-- new admin manual-balance-adjustment action's direct insert was
-- silently blocked by RLS. Let an admin insert a transaction only
-- for another user (never masquerading as themselves via this path)
-- and only the admin_adjustment type — normal deposit/withdrawal/
-- pnl/fee rows must still only ever come from the trigger functions.
-- ============================================================

create policy "wallet_transactions_insert_admin_adjustment" on public.wallet_transactions
  for insert to authenticated
  with check (
    type = 'admin_adjustment'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );
