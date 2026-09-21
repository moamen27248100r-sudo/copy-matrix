-- Leader profile pictures: direct Unsplash image URLs (see
-- src/lib/leader-avatar-library.mjs), picked per leader from a hash of its id.
-- New leaders get one through the trigger. Admin-uploaded pictures (Supabase
-- storage URLs) are left untouched.

create or replace function public.pick_leader_avatar(p_id uuid)
returns text
language sql
immutable
as $$
  select (array['https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=150&auto=format&fit=crop&q=80','https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=150&auto=format&fit=crop&q=80','https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80','https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80','https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'])[1 + (abs(hashtext(p_id::text)) % 5)]
$$;

update public.providers
set avatar_url = public.pick_leader_avatar(id)
where avatar_url is null or avatar_url not like '%/storage/v1/%';

create or replace function public.set_provider_default_avatar()
returns trigger
language plpgsql
as $$
begin
  if new.avatar_url is null then
    new.avatar_url := public.pick_leader_avatar(new.id);
  end if;
  return new;
end;
$$;
