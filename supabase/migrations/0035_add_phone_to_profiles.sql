-- ============================================================
-- Copy Matrix — add a phone number field to signup, matching the
-- country/dial-code pattern of any professional platform. Stored as
-- one combined string (dial code + digits) on public.profiles.
-- ============================================================

alter table public.profiles add column if not exists phone text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email, account_type, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'account_type', 'demo'),
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$;
