-- ============================================================
-- Copy Matrix — let admins create, edit, and remove platform-
-- curated leaders (providers with no login account of their own)
-- from the admin panel. providers_insert_own/update_own/delete_own
-- only allow a provider to manage their own linked row, so this is
-- a separate, narrower set of policies scoped to admins.
-- ============================================================

create policy "providers_insert_admin" on public.providers
  for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "providers_update_admin" on public.providers
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "providers_delete_admin" on public.providers
  for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
