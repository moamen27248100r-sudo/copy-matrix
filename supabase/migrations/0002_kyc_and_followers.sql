-- ============================================================
-- Copy Matrix — KYC submissions + public follower counts
-- ============================================================

create table public.kyc_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  full_name text not null,
  national_id_number text not null,
  id_document_path text not null,
  address_proof_path text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table public.kyc_submissions enable row level security;

create policy "kyc_select_own" on public.kyc_submissions
  for select to authenticated using (user_id = auth.uid());

create policy "kyc_insert_own" on public.kyc_submissions
  for insert to authenticated with check (user_id = auth.uid());

-- Private storage bucket for ID documents — each user can only reach
-- files under a folder named after their own user id.
insert into storage.buckets (id, name, public)
values ('kyc-documents', 'kyc-documents', false)
on conflict (id) do nothing;

create policy "kyc_docs_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'kyc-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "kyc_docs_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'kyc-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Public follower counts per provider. Deliberately owned by the
-- migration role (not security_invoker) so the aggregate count is
-- accurate even though individual subscription rows stay private.
create view public.provider_followers as
select provider_id, count(*) as followers_count
from public.subscriptions
where is_active = true
group by provider_id;
