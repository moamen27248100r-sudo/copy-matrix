-- ============================================================
-- Copy Matrix — root-cause fix + full renormalization.
--
-- Migration 0034 made total_profit a real derived P&L (up on a win,
-- down on a loss, computed from the actual closed trade). Migration
-- 0040 (a later, unrelated change to symbol concentration) replaced
-- the whole run_market_simulation() function and, in doing so,
-- accidentally reverted 0034's fix: it went back to bumping
-- total_profit by a blind random *positive* amount for 20% of
-- leaders every tick, and base_followers_count by a blind random
-- *positive* amount for 30% of leaders every tick — both completely
-- disconnected from whether that leader was actually winning or
-- losing. Running every 5 minutes since, this produced leaders with
-- a 19% real win rate and a deeply negative average return that
-- still show a *positive* lifetime profit and more followers than
-- the platform's best-performing leader.
--
-- This migration:
--   1. Recomputes total_profit for every leader from their actual
--      closed-trade history (same real P&L formula the simulation
--      itself uses per trade), wiping out years of unrelated random
--      drift so profit genuinely matches each leader's real skill.
--   2. Recomputes base_followers_count from tenure combined with
--      real performance (skill) instead of tenure alone, with a
--      flagship visibility boost and per-leader noise — long-tenured
--      strong performers end up with the most copiers, long-tenured
--      weak performers end up mostly churned down to a small base,
--      exactly like real copiers would abandon a losing leader.
--   3. Recomputes total_withdrawals as a realistic share of real
--      lifetime profit for winners, or a small tenure-based trickle
--      (never tied to profit) for net losers.
--   4. Rewrites run_market_simulation() so this can't regress again:
--      every future closed trade adds/subtracts its own real dollar
--      P&L, followers grow only on real wins (flagships fastest,
--      strugglers can also lose followers on a loss), and withdrawals
--      only ever accrue from real positive P&L.
-- ============================================================

do $$
declare
  v_provider record;
  v_tenure_days numeric;
  v_is_flagship boolean;
  v_followers_per_day numeric;
  v_noise numeric;
  v_new_followers int;
  v_new_profit numeric;
  v_new_withdrawals numeric;
begin
  for v_provider in
    select id, display_name, skill, created_at
    from public.providers
    where user_id is null
  loop
    v_tenure_days := greatest(1, extract(epoch from (now() - v_provider.created_at)) / 86400);
    v_is_flagship := v_provider.display_name in ('أنس ريان', 'يوسف علي');

    -- 1. Real profit, derived from the actual closed-trade history.
    select coalesce(round(sum(
      2000 * ((s.exit_price - s.entry_price) / s.entry_price) * (case when s.side = 'sell' then -1 else 1 end)
    )::numeric, 2), 0)
    into v_new_profit
    from public.signals s
    where s.provider_id = v_provider.id and s.status = 'closed';

    -- 2. Followers: tenure x real performance x noise, flagships boosted
    --    for their platform-wide visibility.
    v_followers_per_day := 0.25 + greatest(0, v_provider.skill - 0.20) * 5.5;
    v_noise := 0.65 + random() * 0.70;
    v_new_followers := greatest(3, round(v_tenure_days * v_followers_per_day * v_noise)::int);
    if v_is_flagship then
      v_new_followers := round(v_new_followers * (2.0 + random() * 0.6))::int;
    end if;

    -- 3. Withdrawals: a real share of genuine profit, or a small
    --    trickle (never tied to a fake profit figure) for net losers.
    if v_new_profit > 0 then
      v_new_withdrawals := round((v_new_profit * (0.12 + random() * 0.28))::numeric, 2);
    else
      v_new_withdrawals := round((greatest(500, v_tenure_days * (3 + random() * 10)))::numeric, 2);
    end if;

    update public.providers
    set total_profit = v_new_profit,
        base_followers_count = v_new_followers,
        total_withdrawals = v_new_withdrawals
    where id = v_provider.id;
  end loop;
end $$;

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
  v_symbol text;
  v_symbol_idx int;
  v_side text;
  v_entry numeric;
  v_move numeric;
  v_is_win boolean;
  v_is_flagship boolean;
  v_is_struggling boolean;
  v_notional numeric := 2000;
  v_pnl numeric;
  v_withdrawal_bump numeric;
  v_follower_delta int;
  v_roll numeric;
begin
  v_dow := extract(dow from now());
  if v_dow = 0 or v_dow = 6 then
    return;
  end if;

  v_month_day := to_char(now(), 'MM-DD');
  if v_month_day in ('01-01', '12-25') then
    return;
  end if;

  for v_signal in
    select s.id, s.provider_id, s.side, s.entry_price,
      coalesce(p.skill, 0.55) as skill, p.display_name
    from public.signals s
    join public.providers p on p.id = s.provider_id
    where s.status = 'open'
      and s.opened_at < now() - (floor(random() * 180 + 30) || ' minutes')::interval
    order by s.opened_at asc
    limit 40
  loop
    v_is_win := random() < v_signal.skill;
    v_is_flagship := v_signal.display_name in ('أنس ريان', 'يوسف علي');
    v_is_struggling := (not v_is_flagship) and v_signal.skill < 0.35;

    if v_is_flagship then
      v_move := case when v_is_win then 0.008 + random() * 0.014 else 0.005 + random() * 0.010 end;
    elsif v_is_struggling then
      v_move := case when v_is_win then 0.005 + random() * 0.015 else 0.020 + random() * 0.070 end;
    else
      v_move := case when v_is_win then 0.010 + random() * 0.080 else 0.003 + random() * 0.022 end;
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

    -- Real derived P&L for this trade — the only thing that ever
    -- moves total_profit, up on a win, down on a loss.
    v_pnl := round((v_notional * v_move * (case when v_is_win then 1 else -1 end))::numeric, 2);

    -- Withdrawals only ever accrue from real positive P&L (copiers
    -- cashing out an actual gain), never a random bump.
    v_withdrawal_bump := case
      when v_pnl > 0 and random() < 0.35 then round((v_pnl * (0.1 + random() * 0.3))::numeric, 2)
      else 0
    end;

    -- Followers react to the real outcome: wins can bring new
    -- copiers in (flagships fastest, thanks to their visibility),
    -- while a loss can cost a struggling leader followers who churn
    -- out — a steady winner essentially never loses followers.
    v_follower_delta := case
      when v_is_win and random() < (case when v_is_flagship then 0.5 else 0.22 end)
        then 1 + floor(random() * (case when v_is_flagship then 3 else 2 end))::int
      when (not v_is_win) and v_is_struggling and random() < 0.30
        then -(1 + floor(random() * 2)::int)
      when (not v_is_win) and (not v_is_struggling) and random() < 0.08
        then -1
      else 0
    end;

    update public.providers
    set total_profit = total_profit + v_pnl,
        total_withdrawals = total_withdrawals + v_withdrawal_bump,
        base_followers_count = greatest(0, base_followers_count + v_follower_delta)
    where id = v_signal.provider_id;
  end loop;

  -- Open new signals, following each leader's own instrument bias.
  for v_provider in
    select id, symbol_bias from public.providers order by random() limit (5 + floor(random() * 10)::int)
  loop
    if random() < 0.4 then
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
        v_symbol := v_symbols[1 + floor(random() * array_length(v_symbols, 1))::int];
      end if;
      v_symbol_idx := array_position(v_symbols, v_symbol);
      v_side := case when random() < 0.5 then 'buy' else 'sell' end;
      v_entry := round((v_base_prices[v_symbol_idx] * (1 + (random() - 0.5) * 0.01))::numeric, 4);
      insert into public.signals (provider_id, symbol, side, entry_price, status, opened_at)
      values (v_provider.id, v_symbol, v_side, v_entry, 'open', now());
    end if;
  end loop;
end;
$function$;
