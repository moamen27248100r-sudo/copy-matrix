-- 0261: twenty crypto instruments from the Binance public API
--
-- The price fetch (every 10 seconds, pg_cron + pg_net) now asks Binance's public ticker (no key) for
-- 20 coins against USDT instead of 5; PAXG (gold) and EURUSDT (euro) are unchanged. The apply step
-- already writes any symbol it receives, so nothing else changes there.
-- market_snapshot() also returns when each price was last updated and the date of a daily reference
-- rate, so the app can show only instruments whose source is working and say when a price is daily.
-- Rollback: supabase/rollback/0261_more_crypto.sql

begin;

create or replace function public.fire_price_fetch_requests()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_crypto_request_id bigint;
  v_forex_request_id bigint;
begin
  select net.http_get(
    url := 'https://api.binance.com/api/v3/ticker/price?symbols=%5B%22BTCUSDT%22%2C%22ETHUSDT%22%2C%22BNBUSDT%22%2C%22SOLUSDT%22%2C%22XRPUSDT%22%2C%22ADAUSDT%22%2C%22DOGEUSDT%22%2C%22TRXUSDT%22%2C%22AVAXUSDT%22%2C%22LINKUSDT%22%2C%22DOTUSDT%22%2C%22LTCUSDT%22%2C%22NEARUSDT%22%2C%22SUIUSDT%22%2C%22UNIUSDT%22%2C%22BCHUSDT%22%2C%22ATOMUSDT%22%2C%22XLMUSDT%22%2C%22TONUSDT%22%2C%22SHIBUSDT%22%2C%22PAXGUSDT%22%2C%22EURUSDT%22%5D'
  ) into v_crypto_request_id;

  select net.http_get(
    url := 'https://api.frankfurter.app/latest?from=USD&to=GBP,JPY'
  ) into v_forex_request_id;

  insert into public._price_fetch_state (source, request_id) values ('crypto', v_crypto_request_id)
  on conflict (source) do update set request_id = excluded.request_id;
  insert into public._price_fetch_state (source, request_id) values ('forex', v_forex_request_id)
  on conflict (source) do update set request_id = excluded.request_id;
end;
$function$;

drop function if exists public.market_snapshot();
create function public.market_snapshot()
returns table (symbol text, price numeric, open_24h numeric, high_24h numeric, low_24h numeric, change_pct numeric, spark numeric[],
               updated_at timestamptz, source_date date)
language sql stable security definer set search_path to 'public'
as $function$
  select mp.symbol::text, mp.price::numeric, a.open_24h, a.high_24h, a.low_24h,
         case when a.open_24h > 0 then round(((mp.price - a.open_24h) / a.open_24h * 100)::numeric, 3) end,
         a.spark, mp.updated_at, mp.source_date
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

revoke all on function public.market_snapshot() from public, anon;
grant execute on function public.market_snapshot() to authenticated, service_role;

commit;
