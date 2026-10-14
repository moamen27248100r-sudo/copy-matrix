-- 0262: a ready watchlist for every new customer
--
-- When a customer's profile is created (sign-up), six well-known instruments are put on their
-- market watchlist so the home page and the Markets page are not empty on day one:
--   BTC/USDT, ETH/USDT, XAU/USD, EUR/USD, SOL/USDT, BNB/USDT.
-- The customer can remove or add instruments afterwards (the star on any instrument). Existing
-- customers keep exactly the watchlist they have.
-- Rollback: supabase/rollback/0262_default_watchlist.sql

begin;

create or replace function public.seed_default_watchlist()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.market_watchlist (user_id, symbol)
  select new.id, s from unnest(array['BTCUSDT', 'ETHUSDT', 'XAUUSD', 'EURUSD', 'SOLUSDT', 'BNBUSDT']) as s
  on conflict do nothing;
  return null;
exception when others then
  return null; -- never block a sign-up because of a watchlist
end $$;
revoke all on function public.seed_default_watchlist() from public, anon, authenticated;

drop trigger if exists trg_profiles_default_watchlist on public.profiles;
create trigger trg_profiles_default_watchlist after insert on public.profiles
  for each row execute function public.seed_default_watchlist();

commit;
