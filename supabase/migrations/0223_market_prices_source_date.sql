-- market_prices.updated_at is the cron fetch time (every 10s), so for forex it
-- says nothing about how old the underlying rate is (frankfurter/ECB publishes
-- once per weekday). source_date records the rate's own publication date so the
-- UI can label forex prices honestly. Crypto/gold leave it NULL (live).

ALTER TABLE public.market_prices ADD COLUMN IF NOT EXISTS source_date date;

CREATE OR REPLACE FUNCTION public.apply_price_fetch_responses()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_crypto_request_id bigint;
  v_forex_request_id bigint;
  v_crypto_body jsonb;
  v_forex_body jsonb;
  v_item jsonb;
  v_binance_symbol text;
  v_price numeric;
  v_out_symbol text;
  v_eur numeric;
  v_gbp numeric;
  v_jpy numeric;
  v_forex_date date;
  v_now timestamptz := now();
begin
  select request_id into v_crypto_request_id from public._price_fetch_state where source = 'crypto';
  select request_id into v_forex_request_id from public._price_fetch_state where source = 'forex';

  if v_crypto_request_id is not null then
    begin
      select content::jsonb into v_crypto_body
      from net._http_response
      where id = v_crypto_request_id and status_code = 200;

      if v_crypto_body is not null then
        for v_item in select * from jsonb_array_elements(v_crypto_body)
        loop
          v_binance_symbol := v_item ->> 'symbol';
          v_price := (v_item ->> 'price')::numeric;
          v_out_symbol := case when v_binance_symbol = 'PAXGUSDT' then 'XAUUSD' else v_binance_symbol end;

          insert into public.market_prices (symbol, price, updated_at)
          values (v_out_symbol, v_price, v_now)
          on conflict (symbol) do update set price = excluded.price, updated_at = excluded.updated_at;

          insert into public.price_history (symbol, ts, price)
          values (v_out_symbol, v_now, v_price)
          on conflict (symbol, ts) do nothing;
        end loop;
      end if;
    exception when others then
      null;
    end;
  end if;

  if v_forex_request_id is not null then
    begin
      select content::jsonb -> 'rates', nullif(content::jsonb ->> 'date', '')::date into v_forex_body, v_forex_date
      from net._http_response
      where id = v_forex_request_id and status_code = 200;

      if v_forex_body is not null then
        v_eur := (v_forex_body ->> 'EUR')::numeric;
        v_gbp := (v_forex_body ->> 'GBP')::numeric;
        v_jpy := (v_forex_body ->> 'JPY')::numeric;

        if v_eur is not null and v_eur > 0 then
          insert into public.market_prices (symbol, price, updated_at, source_date) values ('EURUSD', 1 / v_eur, v_now, v_forex_date)
          on conflict (symbol) do update set price = excluded.price, updated_at = excluded.updated_at, source_date = coalesce(excluded.source_date, public.market_prices.source_date);
          insert into public.price_history (symbol, ts, price) values ('EURUSD', v_now, 1 / v_eur)
          on conflict (symbol, ts) do nothing;
        end if;
        if v_gbp is not null and v_gbp > 0 then
          insert into public.market_prices (symbol, price, updated_at, source_date) values ('GBPUSD', 1 / v_gbp, v_now, v_forex_date)
          on conflict (symbol) do update set price = excluded.price, updated_at = excluded.updated_at, source_date = coalesce(excluded.source_date, public.market_prices.source_date);
          insert into public.price_history (symbol, ts, price) values ('GBPUSD', v_now, 1 / v_gbp)
          on conflict (symbol, ts) do nothing;
        end if;
        if v_jpy is not null then
          insert into public.market_prices (symbol, price, updated_at, source_date) values ('USDJPY', v_jpy, v_now, v_forex_date)
          on conflict (symbol) do update set price = excluded.price, updated_at = excluded.updated_at, source_date = coalesce(excluded.source_date, public.market_prices.source_date);
          insert into public.price_history (symbol, ts, price) values ('USDJPY', v_now, v_jpy)
          on conflict (symbol, ts) do nothing;
        end if;
      end if;
    exception when others then
      null;
    end;
  end if;
end;
$function$;
