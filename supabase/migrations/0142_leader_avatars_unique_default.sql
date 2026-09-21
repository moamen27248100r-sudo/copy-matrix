-- Leader pictures: no repeats. The few real photos (src/lib/leader-avatar-library.mjs)
-- go to the top-ranked leaders via scripts/assign-leader-avatars.mjs, one photo
-- per leader; every other leader -- and every new one -- gets its own generated
-- chart avatar (/api/avatar/<id>, unique per id).
-- The "?v=" number must match AVATAR_VERSION in src/lib/avatar-url.ts.

drop function if exists public.pick_leader_avatar(uuid);

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
