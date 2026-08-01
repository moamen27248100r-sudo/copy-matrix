-- ============================================================
-- Copy Matrix — initial schema
-- Signal-mirroring / simulated copy-trading tracker (no real
-- order execution, no real broker connection).
-- ============================================================

-- ---------- Tables ----------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  is_provider boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.providers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  bio text,
  created_at timestamptz not null default now()
);

create table public.signals (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers (id) on delete cascade,
  symbol text not null,
  side text not null check (side in ('buy', 'sell')),
  entry_price numeric not null check (entry_price > 0),
  stop_loss numeric,
  take_profit numeric,
  exit_price numeric,
  status text not null default 'open' check (status in ('open', 'closed')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles (id) on delete cascade,
  provider_id uuid not null references public.providers (id) on delete cascade,
  risk_multiplier numeric not null default 1 check (risk_multiplier > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (follower_id, provider_id)
);

create table public.simulated_positions (
  id uuid primary key default gen_random_uuid(),
  signal_id uuid not null references public.signals (id) on delete cascade,
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  follower_id uuid not null references public.profiles (id) on delete cascade,
  entry_price numeric not null,
  exit_price numeric,
  size numeric not null default 1,
  status text not null default 'open' check (status in ('open', 'closed')),
  pnl numeric,
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

create table public.market_prices (
  symbol text primary key,
  price numeric not null,
  updated_at timestamptz not null default now()
);

-- ---------- Row Level Security ----------

alter table public.profiles enable row level security;
alter table public.providers enable row level security;
alter table public.signals enable row level security;
alter table public.subscriptions enable row level security;
alter table public.simulated_positions enable row level security;
alter table public.market_prices enable row level security;

-- profiles: everyone signed in can read profiles (needed to show
-- names on the feed), each user can only edit their own row.
create policy "profiles_select" on public.profiles
  for select to authenticated using (true);

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- providers: public directory, owner-only writes.
create policy "providers_select" on public.providers
  for select to authenticated using (true);

create policy "providers_insert_own" on public.providers
  for insert to authenticated with check (user_id = auth.uid());

create policy "providers_update_own" on public.providers
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "providers_delete_own" on public.providers
  for delete to authenticated using (user_id = auth.uid());

-- signals: public feed, only the owning provider can publish/close.
create policy "signals_select" on public.signals
  for select to authenticated using (true);

create policy "signals_insert_own" on public.signals
  for insert to authenticated
  with check (
    provider_id in (select id from public.providers where user_id = auth.uid())
  );

create policy "signals_update_own" on public.signals
  for update to authenticated
  using (
    provider_id in (select id from public.providers where user_id = auth.uid())
  )
  with check (
    provider_id in (select id from public.providers where user_id = auth.uid())
  );

-- subscriptions: strictly private to the follower who owns them.
create policy "subscriptions_select_own" on public.subscriptions
  for select to authenticated using (follower_id = auth.uid());

create policy "subscriptions_insert_own" on public.subscriptions
  for insert to authenticated with check (follower_id = auth.uid());

create policy "subscriptions_update_own" on public.subscriptions
  for update to authenticated
  using (follower_id = auth.uid())
  with check (follower_id = auth.uid());

create policy "subscriptions_delete_own" on public.subscriptions
  for delete to authenticated using (follower_id = auth.uid());

-- simulated_positions: read-only to the owning follower. Rows are
-- only ever written by the trigger functions below (security definer),
-- never directly by a user — this stops anyone from faking results.
create policy "simulated_positions_select_own" on public.simulated_positions
  for select to authenticated using (follower_id = auth.uid());

-- market_prices: readable by any signed-in user, writable only by
-- the service role (the price-fetching Edge Function), never by users.
create policy "market_prices_select" on public.market_prices
  for select to authenticated using (true);

-- ---------- Functions & triggers ----------

-- Creates a profile row automatically whenever someone signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- When a provider publishes a signal, mirror it into a simulated
-- position for every active follower of that provider.
create function public.mirror_signal_to_followers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.simulated_positions (signal_id, subscription_id, follower_id, entry_price, size)
  select new.id, sub.id, sub.follower_id, new.entry_price, sub.risk_multiplier
  from public.subscriptions sub
  where sub.provider_id = new.provider_id
    and sub.is_active = true;
  return new;
end;
$$;

create trigger on_signal_created
  after insert on public.signals
  for each row execute function public.mirror_signal_to_followers();

-- When a provider closes a signal, close out every open simulated
-- position tied to it and record the simulated P&L.
create function public.close_simulated_positions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'closed' and old.status = 'open' then
    update public.simulated_positions
    set exit_price = new.exit_price,
        status = 'closed',
        closed_at = now(),
        pnl = (new.exit_price - entry_price) * size * (case when new.side = 'sell' then -1 else 1 end)
    where signal_id = new.id
      and status = 'open';
  end if;
  return new;
end;
$$;

create trigger on_signal_closed
  after update on public.signals
  for each row execute function public.close_simulated_positions();

-- ---------- Reporting view ----------

-- Aggregated performance per provider, computed from the signals'
-- own entry/exit prices (independent of follower risk multipliers).
create view public.provider_performance
with (security_invoker = true) as
select
  provider_id,
  count(*) filter (where status = 'open') as open_signals,
  count(*) filter (where status = 'closed') as closed_signals,
  round(
    count(*) filter (
      where status = 'closed'
        and ((side = 'buy' and exit_price > entry_price) or (side = 'sell' and exit_price < entry_price))
    )::numeric / nullif(count(*) filter (where status = 'closed'), 0) * 100,
    2
  ) as win_rate_pct,
  round(
    avg(
      case when status = 'closed'
        then (exit_price - entry_price) / entry_price * (case when side = 'sell' then -1 else 1 end) * 100
      end
    ),
    2
  ) as avg_return_pct
from public.signals
group by provider_id;
