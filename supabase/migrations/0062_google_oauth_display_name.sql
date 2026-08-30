-- ============================================================
-- Copy Matrix — adding "Continue with Google" sign-in. The existing
-- handle_new_user() trigger only read raw_user_meta_data->>'display_name',
-- which our own signup form sets but Google's OAuth data never does
-- (Google puts the account's name under 'full_name' / 'name' instead)
-- — a Google sign-up would have fallen back straight to the email
-- prefix. Adds those keys to the fallback chain so a Google account's
-- real name is used when available; behavior for the existing
-- email/password signup form is unchanged since it still sets
-- 'display_name' directly.
-- ============================================================

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
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'account_type', 'demo'),
    new.raw_user_meta_data ->> 'phone',
    case when coalesce(new.raw_user_meta_data ->> 'account_type', 'demo') = 'real' then 0 else 1000 end
  );
  return new;
end;
$$;
