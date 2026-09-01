-- ============================================================
-- Copy Matrix — admin action audit log. Every mutating admin action
-- (approvals, toggles, leader edits, balance adjustments) writes a
-- row here so the admin panel can show a history of what was done,
-- by whom, and when.
-- ============================================================

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles (id),
  action text not null,
  target_type text not null,
  target_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_log enable row level security;

create policy "admin_audit_log_select_admin" on public.admin_audit_log
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
