-- ============================================================
-- Copy Matrix — price_history was only ever populated by the one-time
-- Node backfill (scripts/backfill-price-history.mjs); nothing kept it
-- growing afterward. apply_price_fetch_responses() already fetches a
-- real price for every symbol once a minute — also append each one to
-- price_history (not just upsert the single current-value row in
-- market_prices), so the live trade engine (0077) has a continuously
-- growing real series to reference, not a series frozen at whatever
-- moment the one-time backfill happened to run.
-- ============================================================

create or replace function public.apply_price_fetch_responses()
returns void
language plpgsql
security definer
set search_path = public
as $$
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
      select content::jsonb -> 'rates' into v_forex_body
      from net._http_response
      where id = v_forex_request_id and status_code = 200;

      if v_forex_body is not null then
        v_eur := (v_forex_body ->> 'EUR')::numeric;
        v_gbp := (v_forex_body ->> 'GBP')::numeric;
        v_jpy := (v_forex_body ->> 'JPY')::numeric;

        if v_eur is not null and v_eur > 0 then
          insert into public.market_prices (symbol, price, updated_at) values ('EURUSD', 1 / v_eur, v_now)
          on conflict (symbol) do update set price = excluded.price, updated_at = excluded.updated_at;
          insert into public.price_history (symbol, ts, price) values ('EURUSD', v_now, 1 / v_eur)
          on conflict (symbol, ts) do nothing;
        end if;
        if v_gbp is not null and v_gbp > 0 then
          insert into public.market_prices (symbol, price, updated_at) values ('GBPUSD', 1 / v_gbp, v_now)
          on conflict (symbol) do update set price = excluded.price, updated_at = excluded.updated_at;
          insert into public.price_history (symbol, ts, price) values ('GBPUSD', v_now, 1 / v_gbp)
          on conflict (symbol, ts) do nothing;
        end if;
        if v_jpy is not null then
          insert into public.market_prices (symbol, price, updated_at) values ('USDJPY', v_jpy, v_now)
          on conflict (symbol) do update set price = excluded.price, updated_at = excluded.updated_at;
          insert into public.price_history (symbol, ts, price) values ('USDJPY', v_now, v_jpy)
          on conflict (symbol, ts) do nothing;
        end if;
      end if;
    exception when others then
      null;
    end;
  end if;
end;
$$;
