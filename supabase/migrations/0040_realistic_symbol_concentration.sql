-- ============================================================
-- Copy Matrix — leaders were opening trades on a uniformly random
-- symbol each time, so over dozens of trades every leader ends up
-- with a near-even spread across all 10 instruments. That made the
-- new "أدوات التداول" allocation bar show a misleadingly huge
-- "أخرى" bucket instead of a realistic, concentrated distribution
-- (a gold specialist should mostly trade gold, etc.) — which also
-- didn't match what each leader's own bio already claims to
-- specialize in.
--
-- This migration:
--   1. Gives every provider a persistent symbol_bias ranking
--      (their real, ordered list of preferred instruments),
--      derived from their bio's stated specialty where it matches
--      one, otherwise a deterministic rotation so leaders still
--      differ from each other.
--   2. Reassigns each of their EXISTING signals' symbol to follow
--      a realistic 40/28/16/12/rest concentration on that ranking,
--      regenerating a realistic entry price for the new symbol and
--      an exit price that preserves the exact same percentage
--      return as before — so win/loss outcome, win rate, average
--      return, rating, and profit are mathematically unchanged.
--      Only which instrument each historical trade is labeled as,
--      and its absolute price numbers, change.
--   3. Updates the market-simulation function so newly opened
--      signals keep following each leader's own bias going
--      forward instead of picking uniformly at random.
-- ============================================================

alter table public.providers add column if not exists symbol_bias text[];

do $$
declare
  v_all_symbols text[] := array['BTCUSDT','ETHUSDT','XAUUSD','EURUSD','GBPUSD','USDJPY','SOLUSDT','BNBUSDT','XRPUSDT','US30'];
  v_base_prices numeric[] := array[62000, 3400, 2350, 1.085, 1.27, 156.5, 145, 570, 0.62, 39000];
  v_provider record;
  v_ranking text[];
  v_idx int;
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
  v_orig_side text;
  v_orig_entry numeric;
  v_orig_exit numeric;
  v_new_exit numeric;
  i int;
begin
  for v_provider in select id, bio from public.providers loop
    if v_provider.bio ilike '%رقمي%' then
      v_ranking := array['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','XAUUSD','EURUSD','GBPUSD','USDJPY','US30'];
    elsif v_provider.bio ilike '%ذهب%' or v_provider.bio ilike '%معادن%' then
      v_ranking := array['XAUUSD','EURUSD','GBPUSD','USDJPY','BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','US30'];
    elsif v_provider.bio ilike '%أسهم%' or v_provider.bio ilike '%أمريكي%' then
      v_ranking := array['US30','EURUSD','GBPUSD','USDJPY','XAUUSD','BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT'];
    elsif v_provider.bio ilike '%فوركس%' or v_provider.bio ilike '%الرئيسي%' then
      v_ranking := array['EURUSD','GBPUSD','USDJPY','XAUUSD','US30','BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT'];
    else
      v_idx := (hashtext(v_provider.id::text) & 2147483647) % 10;
      v_ranking := v_all_symbols[v_idx + 1 : 10] || v_all_symbols[1 : v_idx];
    end if;

    update public.providers set symbol_bias = v_ranking where id = v_provider.id;

    select array_agg(id order by random()) into v_signal_ids
    from public.signals where provider_id = v_provider.id;
    v_count := coalesce(array_length(v_signal_ids, 1), 0);
    continue when v_count = 0;

    v_cut1 := round(v_count * 0.40);
    v_cut2 := round(v_count * 0.68);
    v_cut3 := round(v_count * 0.84);
    v_cut4 := round(v_count * 0.96);

    for i in 1..v_count loop
      if i <= v_cut1 then v_target_symbol := v_ranking[1];
      elsif i <= v_cut2 then v_target_symbol := v_ranking[2];
      elsif i <= v_cut3 then v_target_symbol := v_ranking[3];
      elsif i <= v_cut4 then v_target_symbol := v_ranking[4];
      else v_target_symbol := v_ranking[5 + ((i - v_cut4 - 1) % 6)];
      end if;

      v_symbol_idx := array_position(v_all_symbols, v_target_symbol);
      v_base := v_base_prices[v_symbol_idx];
      v_new_entry := v_base * (1 + (random() - 0.5) * 0.02);

      select side, entry_price, exit_price into v_orig_side, v_orig_entry, v_orig_exit
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
  end loop;
end $$;

create or replace function public.run_market_simulation()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dow int;
  v_all_symbols text[] := array['BTCUSDT','ETHUSDT','XAUUSD','EURUSD','GBPUSD','USDJPY','SOLUSDT','BNBUSDT','XRPUSDT','US30'];
  v_base_prices numeric[] := array[62000, 3400, 2350, 1.085, 1.27, 156.5, 145, 570, 0.62, 39000];
  v_signal record;
  v_provider record;
  v_symbol text;
  v_symbol_idx int;
  v_side text;
  v_entry numeric;
  v_move numeric;
  v_is_win boolean;
  v_roll numeric;
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
        exit_price = case
          when (side = 'buy' and v_is_win) or (side = 'sell' and not v_is_win)
            then entry_price * (1 + v_move)
          else entry_price * (1 - v_move)
        end,
        closed_at = now()
    where id = v_signal.id;
  end loop;

  for v_provider in
    select id, symbol_bias from public.providers order by random() limit (5 + floor(random() * 10)::int)
  loop
    if random() < 0.4 then
      -- Follow the leader's own instrument bias (40/28/16/12/rest) instead
      -- of a uniform pick, so their trade mix stays realistically
      -- concentrated on their specialty over time.
      if v_provider.symbol_bias is not null then
        v_roll := random();
        v_symbol := case
          when v_roll < 0.40 then v_provider.symbol_bias[1]
          when v_roll < 0.68 then v_provider.symbol_bias[2]
          when v_roll < 0.84 then v_provider.symbol_bias[3]
          when v_roll < 0.96 then v_provider.symbol_bias[4]
          else v_provider.symbol_bias[5 + floor(random() * 6)::int]
        end;
      else
        v_symbol := v_all_symbols[1 + floor(random() * array_length(v_all_symbols, 1))::int];
      end if;
      v_symbol_idx := array_position(v_all_symbols, v_symbol);
      v_side := case when random() < 0.5 then 'buy' else 'sell' end;
      v_entry := v_base_prices[v_symbol_idx] * (1 + (random() - 0.5) * 0.01);
      insert into public.signals (provider_id, symbol, side, entry_price, status, opened_at)
      values (v_provider.id, v_symbol, v_side, v_entry, 'open', now());
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
