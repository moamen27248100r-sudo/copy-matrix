-- ============================================================
-- Copy Matrix — simulated_positions only had a select-own policy
-- (follower_id = auth.uid()), so the admin panel's "صفقات العميل"
-- section silently returned zero rows for every client — the data
-- was there, RLS just filtered it out for the admin's own session.
-- ============================================================

create policy "simulated_positions_select_admin" on public.simulated_positions
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
