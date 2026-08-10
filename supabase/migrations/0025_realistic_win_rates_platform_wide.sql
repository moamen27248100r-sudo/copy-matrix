-- ============================================================
-- Copy Matrix — win rates across the platform (up to 93%, even the
-- newly-recalibrated 82%) were unrealistically high; real traders
-- rarely sustain more than ~65-68% over a large sample. Rescale
-- every curated leader's persistent skill into a realistic band
-- (38%-66%), preserving their relative ranking, then regenerate
-- each leader's full trade history from scratch so the track
-- record actually reflects the new, realistic win rate — not just
-- future trades.
-- ============================================================

do $$
declare
  v_min_skill numeric;
  v_max_skill numeric;
  v_provider record;
  v_new_skill numeric;
  v_num_signals int;
  v_symbols text[] := array['BTCUSDT','ETHUSDT','XAUUSD','EURUSD','GBPUSD','USDJPY','SOLUSDT','BNBUSDT','XRPUSDT','US30'];
  v_base_prices numeric[] := array[63000, 3400, 4300, 1.085, 1.27, 156.5, 145, 570, 0.62, 39000];
  v_symbol_idx int;
  v_entry numeric;
  v_move numeric;
  v_side text;
  v_is_open boolean;
  v_is_win boolean;
  j int;
begin
  select min(skill), max(skill) into v_min_skill, v_max_skill from public.providers where skill is not null;

  for v_provider in select id, skill from public.providers where skill is not null loop
    -- Rescale into 0.38-0.66, preserving relative order.
    v_new_skill := 0.38 + (v_provider.skill - v_min_skill) / nullif(v_max_skill - v_min_skill, 0) * (0.66 - 0.38);
    v_new_skill := coalesce(v_new_skill, 0.5);

    update public.providers set skill = round(v_new_skill, 4) where id = v_provider.id;

    delete from public.signals where provider_id = v_provider.id;

    v_num_signals := 20 + floor(random() * 35)::int;

    for j in 1..v_num_signals loop
      v_symbol_idx := 1 + floor(random() * 10)::int;
      v_side := case when random() < 0.5 then 'buy' else 'sell' end;
      v_entry := v_base_prices[v_symbol_idx] * (1 + (random() - 0.5) * 0.02);
      v_is_open := random() < 0.1;

      if v_is_open then
        insert into public.signals (provider_id, symbol, side, entry_price, status, opened_at)
        values (
          v_provider.id, v_symbols[v_symbol_idx], v_side, v_entry, 'open',
          now() - (random() * 20 || ' days')::interval
        );
      else
        v_is_win := random() < v_new_skill;
        v_move := 0.006 + random() * 0.022;

        insert into public.signals (provider_id, symbol, side, entry_price, exit_price, status, opened_at, closed_at)
        values (
          v_provider.id,
          v_symbols[v_symbol_idx],
          v_side,
          v_entry,
          case
            when (v_side = 'buy' and v_is_win) or (v_side = 'sell' and not v_is_win)
              then round((v_entry * (1 + v_move))::numeric, 4)
            else round((v_entry * (1 - v_move))::numeric, 4)
          end,
          'closed',
          now() - (random() * 150 + 10 || ' days')::interval,
          now() - (random() * 8 || ' days')::interval
        );
      end if;
    end loop;
  end loop;
end $$;
