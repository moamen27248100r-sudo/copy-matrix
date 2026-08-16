-- ============================================================
-- Copy Matrix — starting balance now depends on account type:
-- demo accounts start with $1,000 (practice funds), real accounts
-- start at $0 (nothing simulated is credited until an admin-approved
-- deposit lands). Applies going forward only — existing profiles are
-- left untouched.
-- ============================================================

alter table public.profiles alter column balance set default 1000;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email, account_type, phone, balance)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'account_type', 'demo'),
    new.raw_user_meta_data ->> 'phone',
    case when coalesce(new.raw_user_meta_data ->> 'account_type', 'demo') = 'real' then 0 else 1000 end
  );
  return new;
end;
$$;
