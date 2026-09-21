-- New leaders get either an initials badge (about 1 in 4) or their own generated
-- chart avatar. Photos are handed out (each to one leader only) by
-- scripts/assign-leader-avatars.mjs. The "?v=" number must match AVATAR_VERSION
-- in src/lib/avatar-url.ts.

create or replace function public.set_provider_default_avatar()
returns trigger
language plpgsql
as $$
begin
  if new.avatar_url is null then
    new.avatar_url := '/api/avatar/' || new.id::text || '?v=3'
      || case when abs(hashtext(new.id::text)) % 4 = 0 then '&k=i' else '' end;
  end if;
  return new;
end;
$$;
