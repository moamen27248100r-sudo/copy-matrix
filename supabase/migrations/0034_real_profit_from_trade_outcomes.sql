-- ============================================================
-- Copy Matrix — total_profit was bumped by an always-positive random
-- amount for a random 20% of providers each tick, completely
-- disconnected from whether that provider actually won or lost their
-- trades. Replace it with a real derived P&L: every time a signal
-- closes, add (win) or subtract (loss) a dollar amount computed from
-- the signal's own move size and a fixed per-trade notional — so
-- إجمالي الأرباح المحققة on the homepage now genuinely tracks the
-- leaders' real trade outcomes, moving up on wins and down on losses,
-- multiple times a day as trades close.
-- ============================================================

create or replace function public.run_market_simulation()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_dow int;
  v_month_day text;
  v_symbols text[] := array['BTCUSDT','ETHUSDT','XAUUSD','EURUSD','GBPUSD','USDJPY','SOLUSDT','BNBUSDT','XRPUSDT','US30'];
  v_base_prices numeric[] := array[62000, 3400, 2350, 1.085, 1.27, 156.5, 145, 570, 0.62, 39000];
  v_signal record;
  v_provider record;
  v_idx int;
  v_side text;
  v_entry numeric;
  v_move numeric;
  v_is_win boolean;
  v_notional numeric := 2000;
  v_pnl numeric;
begin
  v_dow := extract(dow from now());
  if v_dow = 0 or v_dow = 6 then
    return;
  end if;

  -- Fixed-date market holidays (month-day, timezone-agnostic).
  v_month_day := to_char(now(), 'MM-DD');
  if v_month_day in ('01-01', '12-25') then
    return;
  end if;

  for v_signal in
    select s.id, s.provider_id, s.side, s.entry_price, coalesce(p.skill, 0.55) as skill, p.display_name
    from public.signals s
    join public.providers p on p.id = s.provider_id
    where s.status = 'open'
      and s.opened_at < now() - (floor(random() * 180 + 30) || ' minutes')::interval
    order by s.opened_at asc
    limit 40
  loop
    v_is_win := random() < v_signal.skill;
    if v_signal.display_name in ('أنس ريان', 'يوسف علي') then
      -- Calibrated flagship leaders: kept deliberately low-volatility
      -- ("مخاطرة منخفضة") regardless of the platform-wide profile below.
      if v_is_win then
        v_move := 0.008 + random() * 0.014; -- 0.8% - 2.2%
      else
        v_move := 0.005 + random() * 0.010; -- 0.5% - 1.5%
      end if;
    elsif v_is_win then
      v_move := 0.010 + random() * 0.080; -- 1.0% - 9.0% (avg ~5.0%)
    else
      v_move := 0.003 + random() * 0.022; -- 0.3% - 2.5% (avg ~1.4%)
    end if;

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

    -- Real derived P&L for this specific closed trade — up on a win,
    -- down on a loss, never an unrelated random bump.
    v_pnl := round((v_notional * v_move * (case when v_is_win then 1 else -1 end))::numeric, 2);
    update public.providers
    set total_profit = total_profit + v_pnl
    where id = v_signal.provider_id;
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
  set total_withdrawals = total_withdrawals + round((random() * 150)::numeric, 2)
  where user_id is null and random() < 0.2;
end;
$function$;
