-- Notification preferences: per-category in-app delivery. Security alerts can
-- never be switched off. A BEFORE INSERT trigger on notifications drops rows
-- for categories the user has turned off, so every producer honours it.

begin;

create or replace function public.notification_category(p_type text)
returns text language sql immutable as $$
  select case
    when p_type in ('followed_trade_opened', 'followed_trade_closed') then 'trades'
    when p_type in ('copy_opened', 'copy_closed', 'auto_stop_copy') then 'copy'
    when p_type like 'wallet\_%' or p_type like 'kyc\_%' then 'account'
    else 'security'
  end
$$;

create table if not exists public.notification_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('trades', 'copy', 'account')),
  in_app boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);

alter table public.notification_preferences enable row level security;
drop policy if exists notification_preferences_own on public.notification_preferences;
create policy notification_preferences_own on public.notification_preferences
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on public.notification_preferences from anon;
grant select, insert, update on public.notification_preferences to authenticated;

create or replace function public.notifications_respect_preferences()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.notification_preferences p
    where p.user_id = new.user_id
      and p.category = public.notification_category(new.type)
      and p.in_app = false
  ) then
    return null;
  end if;
  return new;
end $$;

drop trigger if exists trg_notifications_respect_preferences on public.notifications;
create trigger trg_notifications_respect_preferences
  before insert on public.notifications
  for each row execute function public.notifications_respect_preferences();

commit;

-- Same 2FA rule as every other user-data table (see 0224).
begin;
drop policy if exists mfa_aal2_required on public.notification_preferences;
create policy mfa_aal2_required on public.notification_preferences as restrictive for all to authenticated
  using ((select public.session_mfa_ok())) with check ((select public.session_mfa_ok()));
commit;
