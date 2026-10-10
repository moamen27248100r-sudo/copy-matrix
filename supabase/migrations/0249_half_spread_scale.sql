-- sim_half_spread returned the right value with a long numeric scale (greatest() with
-- power(10, -dp) carries 16 decimals), so live entries were stored as e.g. 748.290000000000000000.
-- Rounded to the symbol's decimals.
-- Rollback: the definition in 0246.

create or replace function public.sim_half_spread(p_symbol text, p_price numeric)
returns numeric language sql stable set search_path to 'public' as $$
  select round(greatest(power(10::numeric, -s.dp), round(coalesce(s.spread, p_price * s.spread_rel) / 2, s.dp::int)), s.dp::int)
  from public.sim_symbols s where s.symbol = p_symbol
$$;

-- Live trades already stored that way keep their value, written at the symbol's decimals.
update public.signals g
set entry_price = round(g.entry_price, s.dp::int), stop_loss = round(g.stop_loss, s.dp::int), take_profit = round(g.take_profit, s.dp::int)
from public.sim_symbols s
where s.symbol = g.symbol and g.status = 'open' and scale(g.entry_price) > s.dp
  and round(g.entry_price, s.dp::int) = g.entry_price;
