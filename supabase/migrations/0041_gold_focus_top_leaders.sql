-- ============================================================
-- Copy Matrix — make gold (XAUUSD) the primary instrument for the
-- platform's two top leaders (أنس ريان, يوسف علي) and add a fresh
-- batch of trades for each. Everything stays wired to real,
-- per-leader data:
--   - Win/loss on every new trade is rolled against that leader's
--     own stored `skill` (their real win probability), same as the
--     live simulation engine — not hardcoded to always win.
--   - Symbol distribution follows the same 40/28/16/12/rest bias
--     curve as migration 0040, now anchored on XAUUSD first.
--   - Existing signals are re-labeled the same honest way as 0040
--     (new symbol + realistic price for that symbol, exit price
--     recomputed to preserve each trade's exact original percentage
--     return) so gold becomes the dominant pair across their whole
--     history too, not just the new trades — and win rate, average
--     return, rating, and profit stay mathematically unchanged for
--     the rebalanced portion.
-- ============================================================

do $$
declare
  v_all_symbols text[] := array['BTCUSDT','ETHUSDT','XAUUSD','EURUSD','GBPUSD','USDJPY','SOLUSDT','BNBUSDT','XRPUSDT','US30'];
  v_base_prices numeric[] := array[62000, 3400, 2350, 1.085, 1.27, 156.5, 145, 570, 0.62, 39000];
  v_gold_ranking text[] := array['XAUUSD','EURUSD','GBPUSD','USDJPY','BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','US30'];
  v_provider record;
  v_signal_ids uuid[];
  v_count int;
  v_cut1 int;
  v_cut2 int;
  v_cut3 int;
  v_cut4 int;
  v_target_symbol text;
  v_symbol_idx int;
  v_base numeric;
  v_new_entry numeric;
  v_pct numeric;
  v_orig_entry numeric;
  v_orig_exit numeric;
  v_new_exit numeric;
  i int;
  j int;
  v_new_count int;
  v_roll numeric;
  v_side text;
  v_entry numeric;
  v_move numeric;
  v_is_win boolean;
  v_is_open boolean;
  v_days_back numeric;
  v_opened timestamptz;
  v_closed timestamptz;
begin
  for v_provider in
    select id, skill from public.providers where display_name in ('أنس ريان', 'يوسف علي')
  loop
    -- 1) Anchor this leader's bias on gold first.
    update public.providers set symbol_bias = v_gold_ranking where id = v_provider.id;

    -- 2) Rebalance their existing signals onto the new gold-first bias,
    --    preserving each trade's exact percentage return.
    select array_agg(id order by random()) into v_signal_ids
    from public.signals where provider_id = v_provider.id;
    v_count := coalesce(array_length(v_signal_ids, 1), 0);

    if v_count > 0 then
      v_cut1 := round(v_count * 0.40);
      v_cut2 := round(v_count * 0.68);
      v_cut3 := round(v_count * 0.84);
      v_cut4 := round(v_count * 0.96);

      for i in 1..v_count loop
        if i <= v_cut1 then v_target_symbol := v_gold_ranking[1];
        elsif i <= v_cut2 then v_target_symbol := v_gold_ranking[2];
        elsif i <= v_cut3 then v_target_symbol := v_gold_ranking[3];
        elsif i <= v_cut4 then v_target_symbol := v_gold_ranking[4];
        else v_target_symbol := v_gold_ranking[5 + ((i - v_cut4 - 1) % 6)];
        end if;

        v_symbol_idx := array_position(v_all_symbols, v_target_symbol);
        v_base := v_base_prices[v_symbol_idx];
        v_new_entry := v_base * (1 + (random() - 0.5) * 0.02);

        select entry_price, exit_price into v_orig_entry, v_orig_exit
        from public.signals where id = v_signal_ids[i];

        if v_orig_exit is not null then
          v_pct := (v_orig_exit - v_orig_entry) / v_orig_entry;
          v_new_exit := v_new_entry * (1 + v_pct);
          update public.signals
          set symbol = v_target_symbol, entry_price = v_new_entry, exit_price = v_new_exit
          where id = v_signal_ids[i];
        else
          update public.signals
          set symbol = v_target_symbol, entry_price = v_new_entry
          where id = v_signal_ids[i];
        end if;
      end loop;
    end if;

    -- 3) Add a fresh batch of new trades, weighted the same way,
    --    with win/loss rolled against this leader's real skill.
    v_new_count := 30 + floor(random() * 15)::int;

    for j in 1..v_new_count loop
      v_roll := random();
      if v_roll < 0.40 then v_target_symbol := v_gold_ranking[1];
      elsif v_roll < 0.68 then v_target_symbol := v_gold_ranking[2];
      elsif v_roll < 0.84 then v_target_symbol := v_gold_ranking[3];
      elsif v_roll < 0.96 then v_target_symbol := v_gold_ranking[4];
      else v_target_symbol := v_gold_ranking[5 + floor(random() * 6)::int];
      end if;

      v_symbol_idx := array_position(v_all_symbols, v_target_symbol);
      v_side := case when random() < 0.5 then 'buy' else 'sell' end;
      v_entry := v_base_prices[v_symbol_idx] * (1 + (random() - 0.5) * 0.02);

      v_days_back := random() * 45;
      v_opened := now() - (v_days_back || ' days')::interval;
      v_is_open := random() < 0.08;

      if v_is_open then
        insert into public.signals (provider_id, symbol, side, entry_price, status, opened_at)
        values (v_provider.id, v_target_symbol, v_side, v_entry, 'open', v_opened);
      else
        v_is_win := random() < v_provider.skill;
        v_move := 0.005 + random() * 0.03;
        v_closed := least(v_opened + (random() * 3 + 0.1 || ' days')::interval, now());

        insert into public.signals (provider_id, symbol, side, entry_price, exit_price, status, opened_at, closed_at)
        values (
          v_provider.id,
          v_target_symbol,
          v_side,
          v_entry,
          case
            when (v_side = 'buy' and v_is_win) or (v_side = 'sell' and not v_is_win)
              then v_entry * (1 + v_move)
            else v_entry * (1 - v_move)
          end,
          'closed',
          v_opened,
          v_closed
        );
      end if;
    end loop;
  end loop;
end $$;
