-- ============================================================
-- Copy Matrix — every "regular" leader so far shared the same
-- structural flaw: win moves were drawn from a bigger range than
-- loss moves (e.g. wins 1-8%, losses 0.3-2.2%) for literally every
-- leader in that tier, regardless of skill. That's not realistic
-- diversity — it's the same favorable-asymmetry pattern baked into
-- everyone, which is exactly what looked suspicious ("a trader up
-- 30% in a day with only 3% max loss").
--
-- This assigns every non-flagship leader ONE clear, coherent risk
-- archetype and re-rolls their ENTIRE closed-trade history (not just
-- future trades) to match it consistently:
--
--   stable    (~18%): small, roughly symmetric moves (0.5-2% either
--              way) — profitability comes from skill/win-rate, not
--              band asymmetry. "ماشي مستقر برتم قليل."
--   balanced  (~40%): moderate, symmetric moves (1-5% either way).
--              "في المتوسط."
--   good_rr   (~15%): deliberate positive risk/reward, fixed per
--              leader (e.g. lose 1%, win ~3%) — real disciplined
--              trading, not a lucky asymmetric band. "نسبة من الليدر
--              مكسبهم أكثر من خسارتهم."
--   high_risk (~10%): wide, SYMMETRIC moves (5-35% either way) — big
--              wins and genuinely big losses, ~35% of these get one
--              real planted margin-call-level loss in their history.
--              "بيشتغلوا بمخاطرة عالية... وأحيانًا يمرجنوا."
--   struggling(~17%): small wins, big losses (bad risk management) —
--              same pattern as before, kept as its own archetype.
--
-- total_profit is fully recomputed from the real re-rolled history
-- for every affected leader. run_market_simulation() is also updated
-- so future trades keep following each leader's own archetype
-- ("للي جاي الجديد"), not the old flagship/struggling-only logic.
-- ============================================================

alter table public.providers add column if not exists risk_archetype text;
alter table public.providers add column if not exists rr_ratio numeric;

update public.providers
set risk_archetype = 'flagship'
where display_name in ('أنس ريان', 'يوسف علي');

update public.providers p
set
  risk_archetype = case
    when v.roll < 0.18 then 'stable'
    when v.roll < 0.58 then 'balanced'
    when v.roll < 0.73 then 'good_rr'
    when v.roll < 0.83 then 'high_risk'
    else 'struggling'
  end,
  skill = case
    when v.roll < 0.18 then round((0.55 + random() * 0.20)::numeric, 4)
    when v.roll < 0.58 then round((0.40 + random() * 0.25)::numeric, 4)
    when v.roll < 0.73 then round((0.35 + random() * 0.25)::numeric, 4)
    when v.roll < 0.83 then round((0.38 + random() * 0.34)::numeric, 4)
    else round((0.20 + random() * 0.15)::numeric, 4)
  end,
  rr_ratio = case when v.roll >= 0.58 and v.roll < 0.73 then round((2.0 + random() * 1.5)::numeric, 3) else null end
from (
  select id, random() as roll
  from public.providers
  where user_id is null and display_name not in ('أنس ريان', 'يوسف علي')
) v
where p.id = v.id;

-- Re-roll every closed trade for every re-archetyped leader.
update public.signals s
set exit_price = round((
    case when w.is_win
      then s.entry_price * (1 + (case when s.side = 'buy' then 1 else -1 end) * m.move)
      else s.entry_price * (1 - (case when s.side = 'buy' then 1 else -1 end) * m.move)
    end
  )::numeric, 4)
from public.providers pv,
  lateral (select (random() < pv.skill) as is_win) w,
  lateral (
    select case pv.risk_archetype
      when 'stable' then 0.005 + random() * 0.015
      when 'balanced' then 0.010 + random() * 0.040
      when 'high_risk' then 0.05 + random() * 0.30
      when 'struggling' then (case when w.is_win then 0.005 + random() * 0.010 else 0.020 + random() * 0.070 end)
      when 'good_rr' then (case when w.is_win then (0.01 + random() * 0.03) * pv.rr_ratio else 0.01 + random() * 0.03 end)
    end as move
  ) m
where s.provider_id = pv.id
  and s.status = 'closed'
  and pv.risk_archetype is not null
  and pv.risk_archetype <> 'flagship'
  and pv.user_id is null;

-- Plant one real margin-call-level loss for ~35% of high_risk leaders.
with candidates as (
  select id from public.providers where risk_archetype = 'high_risk' and random() < 0.35
),
picks as (
  select distinct on (s.provider_id) s.id, s.side, s.entry_price
  from public.signals s
  join candidates c on c.id = s.provider_id
  where s.status = 'closed'
  order by s.provider_id, random()
)
update public.signals s
set exit_price = round((
    case when s.side = 'buy' then s.entry_price * (1 - (0.20 + random() * 0.20))
         else s.entry_price * (1 + (0.20 + random() * 0.20))
    end
  )::numeric, 4)
from picks
where s.id = picks.id;

-- Recompute total_profit honestly from the real re-rolled history.
update public.providers p
set total_profit = coalesce((
  select round(sum(
    2000 * ((s.exit_price - s.entry_price) / s.entry_price) * (case when s.side = 'sell' then -1 else 1 end)
  )::numeric, 2)
  from public.signals s
  where s.provider_id = p.id and s.status = 'closed'
), 0)
where p.risk_archetype is not null and p.risk_archetype <> 'flagship' and p.user_id is null;

-- Keep future trades consistent with each leader's own archetype.
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
  v_archetype text;
  v_notional numeric := 2000;
  v_pnl numeric;
  v_withdrawal_bump numeric;
  v_follower_delta int;
  v_follower_cap int;
  v_roll numeric;
  v_base_loss numeric;
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
      coalesce(p.skill, 0.55) as skill, p.display_name,
      coalesce(p.risk_archetype, 'balanced') as risk_archetype,
      p.rr_ratio
    from public.signals s
    join public.providers p on p.id = s.provider_id
    where s.status = 'open'
      and s.opened_at < now() - (floor(random() * 180 + 30) || ' minutes')::interval
    order by s.opened_at asc
    limit 40
  loop
    v_is_win := random() < v_signal.skill;
    v_archetype := case when v_signal.display_name in ('أنس ريان', 'يوسف علي') then 'flagship' else v_signal.risk_archetype end;

    case v_archetype
      when 'flagship' then
        v_move := case when v_is_win then 0.008 + random() * 0.014 else 0.005 + random() * 0.010 end;
        v_follower_cap := 2300;
      when 'stable' then
        v_move := 0.005 + random() * 0.015;
        v_follower_cap := 520;
      when 'good_rr' then
        v_base_loss := 0.01 + random() * 0.03;
        v_move := case when v_is_win then v_base_loss * coalesce(v_signal.rr_ratio, 2.5) else v_base_loss end;
        v_follower_cap := 520;
      when 'high_risk' then
        v_move := 0.05 + random() * 0.30;
        v_follower_cap := 2300;
      when 'struggling' then
        v_move := case when v_is_win then 0.005 + random() * 0.010 else 0.020 + random() * 0.070 end;
        v_follower_cap := 60;
      else
        v_move := 0.010 + random() * 0.040;
        v_follower_cap := 520;
    end case;

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

    v_pnl := round((v_notional * v_move * (case when v_is_win then 1 else -1 end))::numeric, 2);

    v_withdrawal_bump := case
      when v_pnl > 0 and random() < 0.35 then round((v_pnl * (0.1 + random() * 0.3))::numeric, 2)
      else 0
    end;

    v_follower_delta := case
      when v_is_win and random() < (case when v_archetype in ('flagship', 'high_risk') then 0.45 else 0.20 end)
        then 1 + floor(random() * (case when v_archetype in ('flagship', 'high_risk') then 6 else 3 end))::int
      when (not v_is_win) and v_archetype = 'struggling' and random() < 0.28
        then -(1 + floor(random() * 2)::int)
      when (not v_is_win) and v_archetype <> 'struggling' and random() < 0.07
        then -(1 + floor(random() * (case when v_archetype in ('flagship', 'high_risk') then 3 else 1 end))::int)
      else 0
    end;

    update public.providers
    set total_profit = total_profit + v_pnl,
        total_withdrawals = total_withdrawals + v_withdrawal_bump,
        base_followers_count = least(v_follower_cap, greatest(1, base_followers_count + v_follower_delta))
    where id = v_signal.provider_id;
  end loop;

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
