-- Notifications belong to an account, like demo / real modes on trading
-- platforms: trading notices (copies, followed leaders, auto-stop) to the
-- account they happened on, wallet notices to the real account, and account /
-- security notices (identity checks, lead trader, integrity) to both (null).
-- The app lists, counts and marks read only the current account's
-- notifications plus the shared ones (my_notifications, mark_my_notifications_read).

begin;

alter table public.notifications add column if not exists account_type text;
alter table public.notifications drop constraint if exists notifications_account_type_check;
alter table public.notifications add constraint notifications_account_type_check
  check (account_type is null or account_type in ('demo', 'real'));

create or replace function public.notification_account_type(p_type text, p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when p_type in ('copy_opened', 'copy_closed', 'auto_stop_copy', 'followed_trade_opened', 'followed_trade_closed')
      -- Switching accounts needs no open copies and stops every copy, so the
      -- account the user is on is the one the trade belongs to.
      then coalesce((select account_type from public.profiles where id = p_user), 'demo')
    when p_type like 'wallet\_%' then 'real'
    else null
  end
$$;

create or replace function public.notifications_set_account_type()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.account_type is null then
    new.account_type := public.notification_account_type(new.type, new.user_id);
  end if;
  return new;
end $$;
drop trigger if exists trg_notifications_set_account_type on public.notifications;
create trigger trg_notifications_set_account_type before insert on public.notifications
  for each row execute function public.notifications_set_account_type();

-- Existing rows: a copy notice takes the account of the copied position it
-- was sent for (closest in time); the rest follow the same rules as new rows.
update public.notifications n set account_type = coalesce((
    select sp.account_type from public.simulated_positions sp
    where sp.follower_id = n.user_id
      and abs(extract(epoch from (
        case when n.type = 'copy_opened' then sp.opened_at else coalesce(sp.closed_at, sp.opened_at) end - n.created_at))) < 300
    order by abs(extract(epoch from (
        case when n.type = 'copy_opened' then sp.opened_at else coalesce(sp.closed_at, sp.opened_at) end - n.created_at)))
    limit 1),
  public.notification_account_type(n.type, n.user_id))
where n.account_type is null and n.type in ('copy_opened', 'copy_closed', 'auto_stop_copy');
update public.notifications n set account_type = public.notification_account_type(n.type, n.user_id)
where n.account_type is null;

create index if not exists notifications_user_account_created_idx
  on public.notifications (user_id, account_type, created_at desc);

-- The signed-in user's notifications for the account they are on, plus the
-- shared ones; p_category narrows to one list of types.
create or replace function public.my_notifications(p_limit integer default 50, p_types text[] default null)
returns setof public.notifications language sql stable security definer set search_path = public as $$
  select n.* from public.notifications n
  where n.user_id = auth.uid()
    and (n.account_type is null
         or n.account_type = (select coalesce(account_type, 'demo') from public.profiles where id = auth.uid()))
    and (p_types is null or n.type = any(p_types))
  order by n.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
$$;

create or replace function public.mark_my_notifications_read()
returns void language sql security definer set search_path = public as $$
  update public.notifications n set is_read = true
  where n.user_id = auth.uid() and not n.is_read
    and (n.account_type is null
         or n.account_type = (select coalesce(account_type, 'demo') from public.profiles where id = auth.uid()))
$$;

revoke all on function public.my_notifications(integer, text[]) from public, anon;
revoke all on function public.mark_my_notifications_read() from public, anon;
grant execute on function public.my_notifications(integer, text[]) to authenticated;
grant execute on function public.mark_my_notifications_read() to authenticated;

commit;
