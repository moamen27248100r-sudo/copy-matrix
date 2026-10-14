-- 0259: markets -- snapshot, instrument history, watchlist, "big move" notifications
--
-- Read functions (no table of prices is changed):
--   market_snapshot()                   price, 24h open/high/low, 24h change and a 24-point sparkline of
--                                       every quoted instrument, from price_history;
--   market_series(symbol, hours)        the price history of one instrument, downsampled for a chart;
--   top_leaders_for_symbol(symbol, n)   the leaders who traded an instrument most in the last 30 days.
-- Tables:
--   market_watchlist(user_id, symbol)   the star on an instrument (own rows only).
--   market_alert_log                    one row per (customer, instrument, day) that was notified, so
--                                       an instrument is never repeated in a day and a customer gets
--                                       at most 3 market notices per day.
-- Notifications:
--   category 'market' for the new type market_move (in the app: on by default, switchable off; by
--   e-mail: off unless switched on);
--   generate_market_alerts() runs every 10 minutes: an instrument that moved more than its threshold
--   over 24 hours (forex 0.6%, gold 1.5%, crypto 4%) notifies the customers who watch it or whose
--   copied leaders trade it. News are NOT notified: the free feed carries no importance indicator.
-- Rollback: supabase/rollback/0259_markets.sql

begin;

-- ---------------------------------------------------------------- watchlist
create table if not exists public.market_watchlist (
  user_id uuid not null references public.profiles (id) on delete cascade,
  symbol text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, symbol)
);
alter table public.market_watchlist enable row level security;
drop policy if exists market_watchlist_own on public.market_watchlist;
create policy market_watchlist_own on public.market_watchlist
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.market_watchlist from anon;
grant select, insert, delete on public.market_watchlist to authenticated;

create table if not exists public.market_alert_log (
  user_id uuid not null references public.profiles (id) on delete cascade,
  symbol text not null,
  day date not null default (now() at time zone 'utc')::date,
  change_pct numeric,
  created_at timestamptz not null default now(),
  primary key (user_id, symbol, day)
);
alter table public.market_alert_log enable row level security;
revoke all on public.market_alert_log from anon, authenticated;

-- ---------------------------------------------------------------- read functions
create or replace function public.market_snapshot()
returns table (symbol text, price numeric, open_24h numeric, high_24h numeric, low_24h numeric, change_pct numeric, spark numeric[])
language sql stable security definer set search_path to 'public'
as $function$
  select mp.symbol::text, mp.price::numeric, a.open_24h, a.high_24h, a.low_24h,
         case when a.open_24h > 0 then round(((mp.price - a.open_24h) / a.open_24h * 100)::numeric, 3) end,
         a.spark
  from public.market_prices mp
  cross join lateral (
    with w as (
      select ph.ts, ph.price from public.price_history ph
      where ph.symbol = mp.symbol and ph.ts >= now() - interval '24 hours'
    )
    select (select w.price from w order by w.ts limit 1) as open_24h,
           (select max(w.price) from w) as high_24h,
           (select min(w.price) from w) as low_24h,
           (select array_agg(h.p order by h.b)
              from (select date_bin('1 hour', w.ts, timestamptz '2000-01-01') as b, (array_agg(w.price order by w.ts desc))[1] as p
                    from w group by 1) h) as spark
  ) a
  order by mp.symbol;
$function$;

create or replace function public.market_series(p_symbol text, p_hours integer default 24)
returns table (t timestamptz, price numeric)
language sql stable security definer set search_path to 'public'
as $function$
  with cfg as (
    select greatest(1, least(coalesce(p_hours, 24), 168)) as h
  )
  select date_bin(make_interval(secs => greatest(60, (cfg.h * 3600 / 240))), ph.ts, timestamptz '2000-01-01') as t,
         (array_agg(ph.price order by ph.ts desc))[1]::numeric as price
  from public.price_history ph, cfg
  where ph.symbol = p_symbol and ph.ts >= now() - make_interval(hours => cfg.h)
  group by 1
  order by 1;
$function$;

create or replace function public.top_leaders_for_symbol(p_symbol text, p_limit integer default 5)
returns table (provider_id uuid, trades bigint)
language sql stable security definer set search_path to 'public'
as $function$
  select s.provider_id, count(*)::bigint as trades
  from public.signals s
  join public.provider_cards pc on pc.provider_id = s.provider_id
  where s.symbol = p_symbol
    and s.opened_at >= now() - interval '30 days'
    and not s.hidden and not s.created_by_admin
    and not coalesce(pc.is_archived, false)
    and coalesce(pc.trading_status, 'active') <> 'stopped'
  group by s.provider_id
  order by count(*) desc, s.provider_id
  limit greatest(1, least(coalesce(p_limit, 5), 20));
$function$;

revoke all on function public.market_snapshot() from public, anon;
revoke all on function public.market_series(text, integer) from public, anon;
revoke all on function public.top_leaders_for_symbol(text, integer) from public, anon;
grant execute on function public.market_snapshot() to authenticated, service_role;
grant execute on function public.market_series(text, integer) to authenticated, service_role;
grant execute on function public.top_leaders_for_symbol(text, integer) to authenticated, service_role;

-- ---------------------------------------------------------------- notification category
alter table public.notification_preferences drop constraint if exists notification_preferences_category_check;
alter table public.notification_preferences
  add constraint notification_preferences_category_check
  check (category in ('trades', 'copy', 'copy_trades', 'account', 'market'));

create or replace function public.notification_category(p_type text)
returns text language sql immutable as $$
  select case
    when p_type in ('copy_opened', 'copy_closed') then 'copy_trades'
    when p_type in ('followed_trade_opened', 'followed_trade_closed') then 'trades'
    when p_type in ('copy_started', 'copy_stopped', 'auto_stop_copy', 'loss_alert', 'leader_stopped') then 'copy'
    when p_type like 'market\_%' then 'market'
    when p_type like 'wallet\_%' or p_type like 'kyc\_%' then 'account'
    else 'security'
  end
$$;

-- e-mail: market notices stay off until switched on (in the app they are on until switched off)
create or replace function public.email_category_enabled(p_user uuid, p_category text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when p_category = 'security' then true
    else coalesce(
      (select email from public.notification_preferences where user_id = p_user and category = p_category),
      p_category not in ('trades', 'copy_trades', 'market'))
  end
$$;

-- ---------------------------------------------------------------- the alert generator
create or replace function public.market_move_threshold(p_symbol text)
returns numeric language sql immutable as $$
  select case
    when p_symbol = 'XAUUSD' then 1.5
    when p_symbol like '%USDT' then 4.0
    else 0.6
  end
$$;

create or replace function public.generate_market_alerts()
returns integer
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_inserted integer := 0;
  r record;
begin
  -- Candidate (customer, instrument) pairs: instruments over their threshold that the customer
  -- watches or whose copied leaders trade (an open trade, or the leader's main instrument).
  for r in
    with moved as (
      select s.symbol, s.change_pct, s.price
      from public.market_snapshot() s
      where s.change_pct is not null and abs(s.change_pct) >= public.market_move_threshold(s.symbol)
    ),
    interest as (
      select w.user_id, w.symbol from public.market_watchlist w
      union
      select sub.follower_id, sg.symbol
      from public.subscriptions sub
      join public.signals sg on sg.provider_id = sub.provider_id and sg.status = 'open'
      where sub.is_active
      union
      select sub.follower_id, st.primary_symbol
      from public.subscriptions sub
      join public.provider_stats st on st.provider_id = sub.provider_id
      where sub.is_active and st.primary_symbol is not null
    ),
    pairs as (
      select i.user_id, m.symbol, m.change_pct, m.price,
             row_number() over (partition by i.user_id order by abs(m.change_pct) desc, m.symbol) as rn
      from interest i
      join moved m on m.symbol = i.symbol
      where not exists (
        select 1 from public.market_alert_log l where l.user_id = i.user_id and l.symbol = m.symbol and l.day = v_today
      )
    )
    select p.user_id, p.symbol, p.change_pct, p.price
    from pairs p
    where p.rn + coalesce((select count(*) from public.market_alert_log l where l.user_id = p.user_id and l.day = v_today), 0) <= 3
  loop
    insert into public.market_alert_log (user_id, symbol, day, change_pct) values (r.user_id, r.symbol, v_today, r.change_pct)
    on conflict do nothing;
    if found then
      insert into public.notifications (user_id, type, title, body, data)
      values (r.user_id, 'market_move', 'حركة كبيرة في السوق', null,
              jsonb_build_object('symbol', r.symbol, 'changePct', r.change_pct, 'price', r.price));
      v_inserted := v_inserted + 1;
    end if;
  end loop;
  return v_inserted;
end;
$function$;

revoke all on function public.generate_market_alerts() from public, anon, authenticated;
grant execute on function public.generate_market_alerts() to service_role;

do $$
begin
  perform cron.unschedule('market-alerts');
exception when others then null;
end $$;
select cron.schedule('market-alerts', '*/10 * * * *', 'select public.generate_market_alerts()');

-- old log rows are not needed after a few days
create or replace function public.prune_market_alert_log() returns void language sql security definer set search_path to 'public' as $$
  delete from public.market_alert_log where day < (now() at time zone 'utc')::date - 7;
$$;
revoke all on function public.prune_market_alert_log() from public, anon, authenticated;
do $$
begin
  perform cron.unschedule('market-alert-log-prune');
exception when others then null;
end $$;
select cron.schedule('market-alert-log-prune', '17 3 * * *', 'select public.prune_market_alert_log()');

commit;
