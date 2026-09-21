-- Leader avatars: ZuluTrade-style initials badges + trading-chart marks.
-- /api/avatar/<id> now builds the picture from the leader's display name, so
-- every leader (existing and new) gets an avatar_url pointing at it. The "?v="
-- number must match AVATAR_VERSION in src/lib/avatar-url.ts.
--
-- Admin-uploaded pictures (Supabase storage URLs) are left untouched.

update public.providers
set avatar_url = '/api/avatar/' || id::text || '?v=4'
where avatar_url is null or avatar_url not like '%/storage/v1/%';

create or replace function public.set_provider_default_avatar()
returns trigger
language plpgsql
as $$
begin
  if new.avatar_url is null then
    new.avatar_url := '/api/avatar/' || new.id::text || '?v=4';
  end if;
  return new;
end;
$$;

drop trigger if exists providers_default_avatar on public.providers;
create trigger providers_default_avatar
  before insert on public.providers
  for each row execute function public.set_provider_default_avatar();
