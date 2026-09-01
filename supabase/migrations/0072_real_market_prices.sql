-- ============================================================
-- Copy Matrix — market_prices has been empty since it was created;
-- nothing has ever populated it. Populate it with real, free,
-- no-API-key prices every minute:
--   - crypto (BTCUSDT/ETHUSDT/SOLUSDT/BNBUSDT/XRPUSDT): Binance
--     public REST API, live.
--   - gold (XAUUSD): Binance's PAXGUSDT (PAX Gold, ERC-20 token
--     backed 1:1 by physical gold, tracks real spot gold within a
--     small spread) — live, no key. This is the priority the
--     customer asked for specifically (confirmed live: PAXGUSDT was
--     trading around $4,351 when this was built, vs. the platform's
--     old hardcoded gold constant of 2350 — a huge, real gap this
--     closes).
--   - forex (EURUSD/GBPUSD/USDJPY): api.frankfurter.app (ECB rates),
--     free, no key, refreshes once/day on weekdays — accepted as
--     fine, still real data.
--   - US30: intentionally left alone — no free key-less source
--     exists, customer confirmed that's fine.
--
-- pg_net is async: a request returns an id immediately and the
-- response lands in net._http_response shortly after, written by a
-- separate background worker. A single PL/pgSQL function call runs
-- its *entire* body under one snapshot taken when the call started —
-- confirmed empirically against this project's actual pg_net version
-- (0.20.4) — so firing a request and reading its response inside the
-- same function, even after pg_sleep(), never sees it (verified: 4
-- second sleep still returned null; two genuinely separate top-level
-- calls from a fresh connection saw it immediately). This is why
-- firing and reading are two separate functions on two separate cron
-- schedules below, handing the request id off through a small
-- tracking table instead of a local variable.
-- ============================================================

create extension if not exists pg_net;

create table if not exists public._price_fetch_state (
  source text primary key,
  request_id bigint
);

create or replace function public.fire_price_fetch_requests()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_crypto_request_id bigint;
  v_forex_request_id bigint;
begin
  select net.http_get(
    url := 'https://api.binance.com/api/v3/ticker/price?symbols=%5B%22BTCUSDT%22%2C%22ETHUSDT%22%2C%22SOLUSDT%22%2C%22BNBUSDT%22%2C%22XRPUSDT%22%2C%22PAXGUSDT%22%5D'
  ) into v_crypto_request_id;

  select net.http_get(
    url := 'https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY'
  ) into v_forex_request_id;

  insert into public._price_fetch_state (source, request_id) values ('crypto', v_crypto_request_id)
  on conflict (source) do update set request_id = excluded.request_id;
  insert into public._price_fetch_state (source, request_id) values ('forex', v_forex_request_id)
  on conflict (source) do update set request_id = excluded.request_id;
end;
$$;

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
  v_eur numeric;
  v_gbp numeric;
  v_jpy numeric;
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
          insert into public.market_prices (symbol, price, updated_at)
          values (
            case when v_binance_symbol = 'PAXGUSDT' then 'XAUUSD' else v_binance_symbol end,
            v_price,
            now()
          )
          on conflict (symbol) do update set price = excluded.price, updated_at = excluded.updated_at;
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
          insert into public.market_prices (symbol, price, updated_at) values ('EURUSD', 1 / v_eur, now())
          on conflict (symbol) do update set price = excluded.price, updated_at = excluded.updated_at;
        end if;
        if v_gbp is not null and v_gbp > 0 then
          insert into public.market_prices (symbol, price, updated_at) values ('GBPUSD', 1 / v_gbp, now())
          on conflict (symbol) do update set price = excluded.price, updated_at = excluded.updated_at;
        end if;
        if v_jpy is not null then
          insert into public.market_prices (symbol, price, updated_at) values ('USDJPY', v_jpy, now())
          on conflict (symbol) do update set price = excluded.price, updated_at = excluded.updated_at;
        end if;
      end if;
    exception when others then
      null;
    end;
  end if;
end;
$$;

-- Fire every minute; apply every 20s so the read step always lands
-- comfortably after that minute's requests have had time to complete
-- (simple GETs to these APIs finish in well under a second in
-- practice), without the two ever needing to share a snapshot.
select cron.schedule('fire-price-fetch-requests', '* * * * *', $$select public.fire_price_fetch_requests();$$);
select cron.schedule('apply-price-fetch-responses', '20 seconds', $$select public.apply_price_fetch_responses();$$);
