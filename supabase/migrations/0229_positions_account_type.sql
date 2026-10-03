-- Tag every copied position with the account (demo / real) it was opened on so
-- trade history, stats and CSV exports never mix the two accounts.

begin;

alter table public.simulated_positions add column if not exists account_type text;
update public.simulated_positions sp
  set account_type = coalesce((select p.account_type from public.profiles p where p.id = sp.follower_id), 'demo')
  where account_type is null;
alter table public.simulated_positions alter column account_type set default 'demo';
alter table public.simulated_positions alter column account_type set not null;
alter table public.simulated_positions drop constraint if exists simulated_positions_account_type_check;
alter table public.simulated_positions add constraint simulated_positions_account_type_check check (account_type in ('demo', 'real'));

create or replace function public.simulated_positions_set_account_type()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select account_type into new.account_type from public.profiles where id = new.follower_id;
  new.account_type := coalesce(new.account_type, 'demo');
  return new;
end $$;

drop trigger if exists trg_simulated_positions_account_type on public.simulated_positions;
create trigger trg_simulated_positions_account_type before insert on public.simulated_positions
  for each row execute function public.simulated_positions_set_account_type();

create index if not exists simulated_positions_follower_account_idx
  on public.simulated_positions (follower_id, account_type);

commit;
