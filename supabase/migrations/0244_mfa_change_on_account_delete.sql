-- Deleting an account with two-factor authentication failed: the cascade
-- deletes its auth.mfa_factors, track_mfa_change (0233) then tried to record
-- the change for a user that no longer exists, and the foreign key aborted
-- the whole deletion. A factor removed together with its user is not a
-- security change of a live account, so it is skipped.

create or replace function public.track_mfa_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_user uuid;
begin
  if (tg_op = 'INSERT' and new.status = 'verified')
     or (tg_op = 'UPDATE' and new.status is distinct from old.status and (new.status = 'verified' or old.status = 'verified'))
     or (tg_op = 'DELETE' and old.status = 'verified') then
    v_user := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
    if not exists (select 1 from auth.users where id = v_user) then
      return null;
    end if;
    insert into public.account_security_events (user_id, mfa_changed_at) values (v_user, now())
    on conflict (user_id) do update set mfa_changed_at = now();
  end if;
  return null;
end $$;
