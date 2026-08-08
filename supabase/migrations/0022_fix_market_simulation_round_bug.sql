-- ============================================================
-- Copy Matrix — 0021 introduced round(double precision, integer)
-- on the new-signal entry price (numeric * random() resolves to
-- double precision), which doesn't exist in Postgres and has been
-- crashing every market-simulation cron tick since it shipped,
-- rolling back the whole run (closes, opens, growth) each time.
-- Cast to numeric before rounding.
-- ============================================================

create or replace function public.run_market_simulation()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dow int;
  v_symbols text[] := array['BTCUSDT','ETHUSDT','XAUUSD','EURUSD','GBPUSD','USDJPY','SOLUSDT','BNBUSDT','XRPUSDT','US30'];
  v_base_prices numeric[] := array[62000, 3400, 2350, 1.085, 1.27, 156.5, 145, 570, 0.62, 39000];
  v_signal record;
  v_provider record;
  v_idx int;
  v_side text;
  v_entry numeric;
  v_move numeric;
  v_is_win boolean;
begin
  v_dow := extract(dow from now());
  if v_dow = 0 or v_dow = 6 then
    return;
  end if;

  for v_signal in
    select s.id, s.side, s.entry_price, coalesce(p.skill, 0.55) as skill
    from public.signals s
    join public.providers p on p.id = s.provider_id
    where s.status = 'open'
      and s.opened_at < now() - (floor(random() * 180 + 30) || ' minutes')::interval
    order by s.opened_at asc
    limit 40
  loop
    v_is_win := random() < v_signal.skill;
    v_move := 0.003 + random() * 0.025;
    update public.signals
    set status = 'closed',
        exit_price = round(
          case
            when (side = 'buy' and v_is_win) or (side = 'sell' and not v_is_win)
              then entry_price * (1 + v_move)
            else entry_price * (1 - v_move)
          end,
          4
        ),
        closed_at = now()
    where id = v_signal.id;
  end loop;

  for v_provider in
    select id from public.providers order by random() limit (5 + floor(random() * 10)::int)
  loop
    if random() < 0.4 then
      v_idx := 1 + floor(random() * array_length(v_symbols, 1))::int;
      v_side := case when random() < 0.5 then 'buy' else 'sell' end;
      v_entry := round((v_base_prices[v_idx] * (1 + (random() - 0.5) * 0.01))::numeric, 4);
      insert into public.signals (provider_id, symbol, side, entry_price, status, opened_at)
      values (v_provider.id, v_symbols[v_idx], v_side, v_entry, 'open', now());
    end if;
  end loop;

  update public.providers
  set base_followers_count = base_followers_count + floor(random() * 3)::int
  where user_id is null and random() < 0.3;

  update public.providers
  set total_profit = total_profit + round((random() * 500)::numeric, 2),
      total_withdrawals = total_withdrawals + round((random() * 150)::numeric, 2)
  where user_id is null and random() < 0.2;
end;
$$;
