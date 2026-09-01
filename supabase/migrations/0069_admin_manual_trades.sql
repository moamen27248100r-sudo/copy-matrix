-- ============================================================
-- Copy Matrix — let an admin manually create/close trades.
--
-- Trader-level trades (created_by_admin = false, the default) work
-- exactly like a real trade: mirror_signal_to_followers() still
-- copies them to every active follower automatically.
--
-- created_by_admin = true marks a signal the admin created for ONE
-- specific client only — mirror_signal_to_followers() skips its
-- normal "copy to every follower" insert for these, since the admin
-- action inserts the single target simulated_positions row itself.
-- Reusing the signals table (instead of a parallel one) means these
-- individual trades still settle through the exact same
-- close_simulated_positions() trigger and render through the exact
-- same signals join every other position already uses.
-- ============================================================

alter table public.signals add column created_by_admin boolean not null default false;

-- An individual client trade isn't necessarily tied to a live
-- subscription row.
alter table public.simulated_positions alter column subscription_id drop not null;

create or replace function public.mirror_signal_to_followers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by_admin then
    return new;
  end if;

  insert into public.simulated_positions (signal_id, subscription_id, follower_id, entry_price, size)
  select new.id, sub.id, sub.follower_id, new.entry_price, p.balance
  from public.subscriptions sub
  join public.profiles p on p.id = sub.follower_id
  where sub.provider_id = new.provider_id
    and sub.is_active = true
    and p.balance > 0;
  return new;
end;
$$;
