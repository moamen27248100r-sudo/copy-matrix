-- Back to chart-only leader avatars (reverts the initials badges from 0139).
-- The "?v=" number must match AVATAR_VERSION in src/lib/avatar-url.ts.

update public.providers
set avatar_url = '/api/avatar/' || id::text || '?v=3'
where avatar_url is null or avatar_url not like '%/storage/v1/%';

create or replace function public.set_provider_default_avatar()
returns trigger
language plpgsql
as $$
begin
  if new.avatar_url is null then
    new.avatar_url := '/api/avatar/' || new.id::text || '?v=3';
  end if;
  return new;
end;
$$;
