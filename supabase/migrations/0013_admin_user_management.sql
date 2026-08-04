-- ============================================================
-- Copy Matrix — expose email on profiles (so admins can identify
-- users without querying auth.users directly) and add an
-- app-level suspension flag admins can toggle.
-- ============================================================

alter table public.profiles add column email text;
alter table public.profiles add column is_suspended boolean not null default false;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

-- Only an admin may flip another user's admin/suspension flags —
-- profiles_update_own only allows editing your own row, so this is
-- a separate, narrower policy scoped to admins acting on others.
create policy "profiles_update_admin" on public.profiles
  for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
