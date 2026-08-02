-- ============================================================
-- Copy Matrix — admin flag + policies so admins can review KYC
-- submissions and their uploaded documents.
-- ============================================================

alter table public.profiles add column is_admin boolean not null default false;

create policy "kyc_select_admin" on public.kyc_submissions
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "kyc_update_admin" on public.kyc_submissions
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "kyc_docs_select_admin" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'kyc-documents'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );
