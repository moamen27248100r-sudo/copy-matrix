-- ============================================================
-- Copy Matrix — signals only had owner-only insert/update policies
-- (the real provider's own linked account), so an admin action would
-- be silently blocked by RLS. Add admin-scoped policies, matching the
-- existing profiles_update_admin pattern.
--
-- simulated_positions had no insert policy at all (rows only ever
-- came from the security-definer mirror trigger) — admin's direct
-- insert for an individual client trade needs one too, scoped to
-- only the created_by_admin signals so this can't be used to fake a
-- position under a real (non-admin) signal.
-- ============================================================

create policy "signals_insert_admin" on public.signals
  for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "signals_update_admin" on public.signals
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "simulated_positions_insert_admin" on public.simulated_positions
  for insert to authenticated
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
    and exists (select 1 from public.signals s where s.id = signal_id and s.created_by_admin = true)
  );

create policy "simulated_positions_update_admin" on public.simulated_positions
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
