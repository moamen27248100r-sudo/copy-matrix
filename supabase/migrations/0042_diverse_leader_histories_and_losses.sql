-- ============================================================
-- Copy Matrix — every leader currently has a similarly-shaped
-- track record (dates seeded in the same past migration runs,
-- follower counts scaled by one flat multiplier, and nobody ever
-- ends up a net loser because the win-biased move-size bands used
-- for regular leaders make even a mediocre skill level profitable
-- on average). This migration makes the leader population read as
-- an organic mix instead of a uniform batch:
--
--   1. Each leader's join date is pushed back by its own random
--      amount, filling the newly-opened gap with real OLDER closed
--      trades (dated strictly before their current earliest trade,
--      using their own symbol_bias weighting) — so tenure and total
--      trade count vary leader to leader and correlate with each
--      other: a leader pushed far back in time also gets many more
--      backfilled trades; a leader barely pushed back gets few.
--   2. ~16% of non-flagship leaders are marked "struggling": their
--      persisted skill is lowered and their ENTIRE closed-trade
--      history (existing + newly backfilled) is re-rolled against
--      inverted risk bands (small wins, large losses — the classic
--      "cuts winners short, lets losses run" pattern), plus one real
--      dated trade with a severe loss standing in for a margin-call
--      -level blowup. Their total_profit is fully recomputed from
--      that real trade history, so whichever of them end up net
--      negative do so organically from actual signal data, not a
--      fabricated flag.
--   3. Every other leader's total_profit is only incremented by the
--      real $2,000-notional P&L of the new backfilled trades (same
--      formula the live simulation already uses per trade) — their
--      already-established figures are left otherwise untouched.
--   4. Follower counts are recomputed purely from each leader's own
--      final tenure (longer real membership -> more copiers, a
--      freshly-joined leader -> few).
-- ============================================================

do $$
declare
  v_all_symbols text[] := array['BTCUSDT','ETHUSDT','XAUUSD','EURUSD','GBPUSD','USDJPY','SOLUSDT','BNBUSDT','XRPUSDT','US30'];
  v_base_prices numeric[] := array[62000, 3400, 2350, 1.085, 1.27, 156.5, 145, 570, 0.62, 39000];
  v_provider record;
  v_sig record;
  v_is_flagship boolean;
  v_is_struggling boolean;
  v_earliest timestamptz;
  v_extension_days numeric;
  v_new_earliest timestamptz;
  v_new_joined timestamptz;
  v_extra_count int;
  v_new_skill numeric;
  v_roll numeric;
  v_symbol text;
  v_symbol_idx int;
  v_side text;
  v_entry numeric;
  v_move numeric;
  v_is_win boolean;
  v_opened timestamptz;
  v_closed timestamptz;
  v_days_range numeric;
  v_pnl_sum numeric;
  v_trade_pnl numeric;
  v_margin_signal_id uuid;
  j int;
begin
  for v_provider in
    select id, display_name, skill, symbol_bias
    from public.providers
    where user_id is null
  loop
    select min(opened_at) into v_earliest from public.signals where provider_id = v_provider.id;
    continue when v_earliest is null;

    v_is_flagship := v_provider.display_name in ('أنس ريان', 'يوسف علي');
    v_is_struggling := (not v_is_flagship) and random() < 0.16;
    v_pnl_sum := 0;

    -- How far back to push this leader's history — varies leader to
    -- leader so tenure spreads naturally instead of clustering.
    v_roll := random();
    v_extension_days := case
      when v_roll < 0.25 then 30 + random() * 120
      when v_roll < 0.65 then 150 + random() * 400
      else 500 + random() * 700
    end;

    v_new_earliest := v_earliest - (v_extension_days || ' days')::interval;
    if v_new_earliest < timestamp '2022-01-10' then
      v_new_earliest := timestamp '2022-01-10';
    end if;
    v_extension_days := greatest(1, extract(epoch from (v_earliest - v_new_earliest)) / 86400);
    v_new_joined := v_new_earliest - ((1 + random() * 4) || ' days')::interval;

    if v_is_struggling then
      v_new_skill := round((0.20 + random() * 0.15)::numeric, 4);
      update public.providers set skill = v_new_skill where id = v_provider.id;
    else
      v_new_skill := v_provider.skill;
    end if;

    update public.providers
    set created_at = v_new_joined,
        base_followers_count = greatest(
          5,
          round((extract(epoch from (now() - v_new_joined)) / 86400) * (1.5 + random() * 2.5))::int
        )
    where id = v_provider.id;

    -- Fill in the newly extended older window with real trades.
    v_extra_count := greatest(4, least(300, round(v_extension_days * 0.35 * (0.7 + random() * 0.6))::int));
    v_days_range := greatest(0.1, extract(epoch from (v_earliest - v_new_earliest)) / 86400);

    for j in 1..v_extra_count loop
      v_roll := random();
      if v_provider.symbol_bias is not null then
        v_symbol := case
          when v_roll < 0.40 then v_provider.symbol_bias[1]
          when v_roll < 0.68 then v_provider.symbol_bias[2]
          when v_roll < 0.84 then v_provider.symbol_bias[3]
          when v_roll < 0.96 then v_provider.symbol_bias[4]
          else v_provider.symbol_bias[5 + floor(random() * 6)::int]
        end;
      else
        v_symbol := v_all_symbols[1 + floor(random() * 10)::int];
      end if;
      v_symbol_idx := array_position(v_all_symbols, v_symbol);
      v_side := case when random() < 0.5 then 'buy' else 'sell' end;
      v_entry := round((v_base_prices[v_symbol_idx] * (1 + (random() - 0.5) * 0.02))::numeric, 4);

      v_opened := v_new_earliest + ((random() * v_days_range) || ' days')::interval;
      v_closed := least(v_opened + (random() * 3 + 0.1 || ' days')::interval, v_earliest);

      if v_is_flagship then
        v_is_win := random() < v_new_skill;
        v_move := case when v_is_win then 0.008 + random() * 0.014 else 0.005 + random() * 0.010 end;
      elsif v_is_struggling then
        v_is_win := random() < v_new_skill;
        v_move := case when v_is_win then 0.005 + random() * 0.015 else 0.020 + random() * 0.070 end;
      else
        v_is_win := random() < v_new_skill;
        v_move := case when v_is_win then 0.010 + random() * 0.080 else 0.003 + random() * 0.022 end;
      end if;

      insert into public.signals (provider_id, symbol, side, entry_price, exit_price, status, opened_at, closed_at)
      values (
        v_provider.id,
        v_symbol,
        v_side,
        v_entry,
        round((
          case
            when (v_side = 'buy' and v_is_win) or (v_side = 'sell' and not v_is_win)
              then v_entry * (1 + v_move)
            else v_entry * (1 - v_move)
          end
        )::numeric, 4),
        'closed',
        v_opened,
        v_closed
      );

      if not v_is_struggling then
        v_trade_pnl := 2000 * v_move * (case when v_is_win then 1 else -1 end);
        v_pnl_sum := v_pnl_sum + v_trade_pnl;
      end if;
    end loop;

    if v_is_struggling then
      -- Re-roll every existing closed trade's outcome against the new,
      -- lower skill and inverted risk bands so the WHOLE history reads
      -- as one consistent loser, not just the newly backfilled trades.
      for v_sig in
        select id, side, entry_price from public.signals
        where provider_id = v_provider.id and status = 'closed'
      loop
        v_is_win := random() < v_new_skill;
        v_move := case when v_is_win then 0.005 + random() * 0.015 else 0.020 + random() * 0.070 end;
        update public.signals
        set exit_price = round((
          case
            when (v_sig.side = 'buy' and v_is_win) or (v_sig.side = 'sell' and not v_is_win)
              then v_sig.entry_price * (1 + v_move)
            else v_sig.entry_price * (1 - v_move)
          end
        )::numeric, 4)
        where id = v_sig.id;
      end loop;

      -- Plant one real, severely negative trade standing in for a
      -- margin-call-level blowup in this leader's past.
      select id into v_margin_signal_id
      from public.signals
      where provider_id = v_provider.id and status = 'closed'
      order by random() limit 1;

      if v_margin_signal_id is not null then
        update public.signals
        set exit_price = round((
          case
            when side = 'buy' then entry_price * (1 - (0.18 + random() * 0.17))
            else entry_price * (1 + (0.18 + random() * 0.17))
          end
        )::numeric, 4)
        where id = v_margin_signal_id;
      end if;

      update public.providers
      set total_profit = coalesce((
        select round(sum(
          2000 * ((s.exit_price - s.entry_price) / s.entry_price) * (case when s.side = 'sell' then -1 else 1 end)
        )::numeric, 2)
        from public.signals s
        where s.provider_id = v_provider.id and s.status = 'closed'
      ), 0)
      where id = v_provider.id;
    else
      update public.providers
      set total_profit = total_profit + round(v_pnl_sum::numeric, 2)
      where id = v_provider.id;
    end if;
  end loop;
end $$;
