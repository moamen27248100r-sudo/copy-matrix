-- ============================================================
-- Copy Matrix — notifications had no INSERT policy at all (the
-- existing "copy_closed" notifications are created by a trigger
-- function running as security definer, which bypasses RLS entirely).
-- The admin margin-call action needs to insert a notification directly
-- for the affected client, so it needs its own admin-scoped insert
-- policy — same pattern already used across the other admin tables.
-- ============================================================

create policy notifications_insert_admin
  on public.notifications
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin
    )
  );
