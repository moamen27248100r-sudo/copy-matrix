-- 0254: dashboard summary computed in the database
--
-- The customer dashboard used to read every simulated position of the customer and add them up in
-- the server. This moves the totals into one read-only RPC, so the cost no longer grows with the
-- number of trades:
--
--   dashboard_summary(p_tz)        one jsonb document for the signed-in customer's active account:
--                                  closed-trade stats (count, wins, best/worst, gross win/loss),
--                                  today's result in the customer's timezone, open positions and
--                                  floating P&L, net invested funds, per-trader P&L (open +
--                                  realized), open value per asset class, and the equity series
--                                  (individual trades for the last 90 days, one row per day before).
--   benchmark_series(p_symbol, p_days)
--                                  a downsampled price line (BTCUSDT or XAUUSD only) used as the
--                                  reference line on the portfolio chart.
--
-- Net invested = current balance minus lifetime trade results and fees on the account's wallet
-- ledger, i.e. everything ever put in (starting credit, deposits, adjustments) minus withdrawals.
-- Return % in the app is profit / net invested.
--
-- Both functions only ever read the caller's own rows (auth.uid()); nothing is written. Rollback:
-- supabase/rollback/0254_dashboard_summary_rpc.sql.

begin;

create or replace function public.dashboard_summary(p_tz text default 'UTC')
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_type text;
  v_balance numeric;
  v_tz text := 'UTC';
  v_today date;
  v_ledger_pnl numeric;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select account_type, balance into v_type, v_balance from profiles where id = v_uid;
  if v_type is null then
    return null;
  end if;

  -- An unknown timezone name falls back to UTC instead of failing the dashboard.
  begin
    perform now() at time zone coalesce(nullif(p_tz, ''), 'UTC');
    v_tz := coalesce(nullif(p_tz, ''), 'UTC');
  exception when others then
    v_tz := 'UTC';
  end;
  v_today := (now() at time zone v_tz)::date;

  select coalesce(sum(amount), 0) into v_ledger_pnl
  from wallet_transactions
  where user_id = v_uid and account_type = v_type and type in ('pnl', 'fee');

  with pos as (
    select sp.id, sp.subscription_id, sp.status, coalesce(sp.pnl, 0) as pnl, sp.size, sp.closed_at,
           sg.symbol, coalesce(ss.kind, 'other') as kind,
           case when sp.status = 'open' and mp.price is not null and sp.entry_price > 0
                then ((mp.price - sp.entry_price) / sp.entry_price) * (case when sg.side = 'sell' then -1 else 1 end) * sp.size
                else 0 end as upl
    from simulated_positions sp
    join signals sg on sg.id = sp.signal_id
    left join sim_symbols ss on ss.symbol = sg.symbol
    left join market_prices mp on mp.symbol = sg.symbol
    where sp.follower_id = v_uid and sp.account_type = v_type
  ),
  stats as (
    select jsonb_build_object(
      'closed_count', count(*),
      'wins', count(*) filter (where pnl > 0),
      'losses', count(*) filter (where pnl < 0),
      'best', max(pnl),
      'worst', min(pnl),
      'gross_win', coalesce(sum(pnl) filter (where pnl > 0), 0),
      'gross_loss', coalesce(abs(sum(pnl) filter (where pnl < 0)), 0),
      'realized', coalesce(sum(pnl), 0),
      'today', coalesce(sum(pnl) filter (where closed_at is not null and (closed_at at time zone v_tz)::date = v_today), 0)
    ) as j
    from pos where status = 'closed'
  ),
  opn as (
    select jsonb_build_object(
      'count', count(*),
      'unrealized', coalesce(sum(upl), 0),
      'invested', coalesce(sum(size), 0)
    ) as j
    from pos where status = 'open'
  ),
  byp as (
    select coalesce(jsonb_agg(to_jsonb(t) order by t.total desc), '[]'::jsonb) as j
    from (
      select s.provider_id,
             pc.display_name,
             pc.avatar_url,
             pc.rating_score,
             s.allocated_amount as allocated,
             coalesce(sum(p.pnl) filter (where p.status = 'closed'), 0) as realized,
             coalesce(sum(p.upl) filter (where p.status = 'open'), 0) as unrealized,
             coalesce(sum(p.pnl) filter (where p.status = 'closed'), 0) + coalesce(sum(p.upl) filter (where p.status = 'open'), 0) as total,
             count(p.id) filter (where p.status = 'open') as open_count
      from subscriptions s
      left join provider_cards pc on pc.provider_id = s.provider_id
      left join pos p on p.subscription_id = s.id
      where s.follower_id = v_uid and s.is_active
      group by s.id, s.provider_id, pc.display_name, pc.avatar_url, pc.rating_score, s.allocated_amount
    ) t
  ),
  cls as (
    select coalesce(jsonb_agg(jsonb_build_object('class', c.cls, 'value', c.val) order by c.val desc), '[]'::jsonb) as j
    from (
      select case when kind in ('fx', 'fxjpy') then 'forex' when kind = 'metal' then 'metal' when kind = 'crypto' then 'crypto' else 'other' end as cls,
             sum(size + upl) as val
      from pos where status = 'open'
      group by 1
    ) c
  ),
  ser as (
    select coalesce(jsonb_agg(jsonb_build_object('t', extract(epoch from x.at_ts) * 1000, 'v', x.v) order by x.at_ts), '[]'::jsonb) as j
    from (
      select closed_at as at_ts, pnl as v
      from pos
      where status = 'closed' and closed_at is not null and closed_at >= now() - interval '90 days'
      union all
      select date_trunc('day', closed_at) + interval '12 hours' as at_ts, sum(pnl) as v
      from pos
      where status = 'closed' and closed_at is not null and closed_at < now() - interval '90 days'
      group by date_trunc('day', closed_at)
    ) x
  )
  select jsonb_build_object(
    'account_type', v_type,
    'balance', v_balance,
    'net_invested', v_balance - v_ledger_pnl,
    'closed', stats.j,
    'open', opn.j,
    'by_provider', byp.j,
    'by_class', cls.j,
    'series', ser.j
  ) into v_result
  from stats, opn, byp, cls, ser;

  return v_result;
end;
$function$;

revoke all on function public.dashboard_summary(text) from public, anon;
grant execute on function public.dashboard_summary(text) to authenticated, service_role;

create or replace function public.benchmark_series(p_symbol text, p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_from timestamptz;
  v_out jsonb;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_symbol not in ('BTCUSDT', 'XAUUSD') then
    raise exception 'unsupported symbol' using errcode = '22023';
  end if;
  v_from := case when p_days is null or p_days <= 0 then '-infinity'::timestamptz else now() - make_interval(days => p_days) end;

  select coalesce(jsonb_agg(jsonb_build_object('t', extract(epoch from ts) * 1000, 'p', price) order by ts), '[]'::jsonb) into v_out
  from (
    select ts, price, row_number() over (order by ts) as rn, count(*) over () as n
    from price_history
    where symbol = p_symbol and ts >= v_from
  ) h
  where h.rn % greatest(1, ceil(h.n / 90.0)::int) = 0 or h.rn = 1 or h.rn = h.n;

  return v_out;
end;
$function$;

revoke all on function public.benchmark_series(text, integer) from public, anon;
grant execute on function public.benchmark_series(text, integer) to authenticated, service_role;

commit;
