-- ============================================================
-- Copy Matrix — admin_audit_log had a select policy but no insert
-- policy, so RLS silently blocked every insert from the server
-- actions (which run as the authenticated admin, not service role).
-- ============================================================

create policy "admin_audit_log_insert_admin" on public.admin_audit_log
  for insert to authenticated
  with check (
    admin_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );
