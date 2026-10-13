-- 0255: instant benchmark comparison, portfolio summary RPC, portfolio risk input, loss alerts
--
-- 1. benchmark_cache + refresh_benchmark_cache() + benchmark_bundle()
--    The portfolio chart's reference lines (BTC, gold) are downsampled from price_history and kept in
--    a small table that pg_cron refreshes every 5 minutes (same price source the whole platform uses).
--    The dashboard reads every period for both symbols in one cheap call, so the comparison shows at
--    once on the first tap.
-- 2. dashboard_summary: now also returns each copied trader's risk_level (input of the portfolio
--    risk indicator). Same signature as 0254, same everything else.
-- 3. portfolio_summary(p_tz): the dashboard document plus average trade return and the last six
--    months (closed trades, wins, result, deposits, withdrawals), computed in the database so the
--    portfolio page no longer reads every position.
-- 4. Loss alerts: loss_alert_rules (the customer's thresholds, read-only from the app),
--    set_loss_alert() to change them, and evaluate_loss_alerts() run every minute by pg_cron.
--    A breach creates ONE in-app notification (and, for real accounts, the usual email through the
--    existing notification -> email_outbox trigger); the rule re-arms only after the loss falls back
--    under the threshold. It reads the same per-copy history the automatic loss limit uses
--    (closed results of the copy), plus the floating result, and does not touch that limit.
--
-- Rollback: supabase/rollback/0255_benchmark_cache_portfolio_summary_loss_alerts.sql

begin;

-- ---------------------------------------------------------------- 1. benchmark cache

create table if not exists public.benchmark_cache (
  symbol text not null check (symbol in ('BTCUSDT', 'XAUUSD')),
  days integer not null check (days >= 0),
  points jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (symbol, days)
);
alter table public.benchmark_cache enable row level security;
revoke all on public.benchmark_cache from anon, authenticated;

create or replace function public.refresh_benchmark_cache()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  s text;
  d integer;
begin
  foreach s in array array['BTCUSDT', 'XAUUSD'] loop
    foreach d in array array[1, 7, 30, 90, 365, 0] loop
      insert into public.benchmark_cache (symbol, days, points, updated_at)
      select s, d, coalesce(jsonb_agg(jsonb_build_object('t', extract(epoch from h.ts) * 1000, 'p', h.price) order by h.ts), '[]'::jsonb), now()
      from (
        select ts, price, row_number() over (order by ts) as rn, count(*) over () as n
        from public.price_history
        where symbol = s and ts >= case when d = 0 then '-infinity'::timestamptz else now() - make_interval(days => d) end
      ) h
      where h.rn % greatest(1, ceil(h.n / 60.0)::int) = 0 or h.rn = 1 or h.rn = h.n
      on conflict (symbol, days) do update set points = excluded.points, updated_at = excluded.updated_at;
    end loop;
  end loop;
end;
$function$;
revoke all on function public.refresh_benchmark_cache() from public, anon, authenticated;
grant execute on function public.refresh_benchmark_cache() to service_role;

create or replace function public.benchmark_bundle()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  return coalesce((
    select jsonb_object_agg(x.symbol, x.per)
    from (
      select symbol, jsonb_object_agg(days::text, points) as per
      from public.benchmark_cache
      group by symbol
    ) x
  ), '{}'::jsonb);
end;
$function$;
revoke all on function public.benchmark_bundle() from public, anon;
grant execute on function public.benchmark_bundle() to authenticated, service_role;

select public.refresh_benchmark_cache();

do $$
begin
  perform cron.unschedule('refresh-benchmark-cache')
  where exists (select 1 from cron.job where jobname = 'refresh-benchmark-cache');
  perform cron.schedule('refresh-benchmark-cache', '*/5 * * * *', 'select public.refresh_benchmark_cache()');
exception when others then
  raise notice 'pg_cron not available, benchmark cache is refreshed only at migration time: %', sqlerrm;
end $$;

-- ---------------------------------------------------------------- 2. dashboard_summary (+ risk_level)

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
             pc.risk_level,
             s.allocated_amount as allocated,
             coalesce(sum(p.pnl) filter (where p.status = 'closed'), 0) as realized,
             coalesce(sum(p.upl) filter (where p.status = 'open'), 0) as unrealized,
             coalesce(sum(p.pnl) filter (where p.status = 'closed'), 0) + coalesce(sum(p.upl) filter (where p.status = 'open'), 0) as total,
             count(p.id) filter (where p.status = 'open') as open_count
      from subscriptions s
      left join provider_cards pc on pc.provider_id = s.provider_id
      left join pos p on p.subscription_id = s.id
      where s.follower_id = v_uid and s.is_active
      group by s.id, s.provider_id, pc.display_name, pc.avatar_url, pc.rating_score, pc.risk_level, s.allocated_amount
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

-- ---------------------------------------------------------------- 3. portfolio_summary

create or replace function public.portfolio_summary(p_tz text default 'UTC')
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_type text;
  v_base jsonb;
  v_avg numeric;
  v_monthly jsonb;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select account_type into v_type from profiles where id = v_uid;
  if v_type is null then
    return null;
  end if;

  v_base := public.dashboard_summary(p_tz);

  select avg(case when sp.exit_price is null or sp.entry_price <= 0 then 0
                  else ((sp.exit_price - sp.entry_price) / sp.entry_price) * (case when sg.side = 'sell' then -1 else 1 end) * 100 end)
  into v_avg
  from simulated_positions sp
  join signals sg on sg.id = sp.signal_id
  where sp.follower_id = v_uid and sp.account_type = v_type and sp.status = 'closed';

  select coalesce(jsonb_agg(to_jsonb(m) order by m.key desc), '[]'::jsonb) into v_monthly
  from (
    select coalesce(t.key, f.key) as key,
           coalesce(t.trades, 0) as trades,
           coalesce(t.wins, 0) as wins,
           coalesce(t.pnl, 0) as pnl,
           coalesce(f.deposits, 0) as deposits,
           coalesce(f.withdrawals, 0) as withdrawals
    from (
      select to_char(date_trunc('month', closed_at at time zone 'UTC'), 'YYYY-MM') as key,
             count(*) as trades,
             count(*) filter (where coalesce(pnl, 0) > 0) as wins,
             sum(coalesce(pnl, 0)) as pnl
      from simulated_positions
      where follower_id = v_uid and account_type = v_type and status = 'closed' and closed_at is not null
      group by 1
    ) t
    full join (
      select to_char(date_trunc('month', created_at at time zone 'UTC'), 'YYYY-MM') as key,
             sum(abs(amount)) filter (where type = 'deposit') as deposits,
             sum(abs(amount)) filter (where type = 'withdrawal') as withdrawals
      from wallet_transactions
      where user_id = v_uid and account_type = v_type
      group by 1
    ) f on f.key = t.key
    order by coalesce(t.key, f.key) desc
    limit 6
  ) m;

  return v_base || jsonb_build_object('avg_return_pct', v_avg, 'monthly', v_monthly);
end;
$function$;
revoke all on function public.portfolio_summary(text) from public, anon;
grant execute on function public.portfolio_summary(text) to authenticated, service_role;

-- ---------------------------------------------------------------- 4. loss alerts

create table if not exists public.loss_alert_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- null = the whole portfolio; otherwise the trader whose copy it watches
  provider_id uuid references public.providers (id) on delete cascade,
  threshold_pct numeric not null check (threshold_pct >= 1 and threshold_pct <= 90),
  active boolean not null default true,
  -- true while the loss is at or above the threshold (the alert was already sent)
  breached boolean not null default false,
  last_alerted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists loss_alert_rules_unique_idx
  on public.loss_alert_rules (user_id, coalesce(provider_id, '00000000-0000-0000-0000-000000000000'::uuid));

alter table public.loss_alert_rules enable row level security;
drop policy if exists loss_alert_rules_select_own on public.loss_alert_rules;
create policy loss_alert_rules_select_own on public.loss_alert_rules for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists mfa_aal2_required on public.loss_alert_rules;
create policy mfa_aal2_required on public.loss_alert_rules as restrictive for all to authenticated
  using ((select public.session_mfa_ok())) with check ((select public.session_mfa_ok()));
revoke all on public.loss_alert_rules from anon, authenticated;
grant select on public.loss_alert_rules to authenticated;

-- Notifications of this type belong to the account the customer is on and use the copy category
-- (in-app and email switches).
create or replace function public.notification_category(p_type text)
returns text language sql immutable as $$
  select case
    when p_type in ('followed_trade_opened', 'followed_trade_closed') then 'trades'
    when p_type in ('copy_opened', 'copy_closed', 'auto_stop_copy', 'loss_alert') then 'copy'
    when p_type like 'wallet\_%' or p_type like 'kyc\_%' then 'account'
    else 'security'
  end
$$;

create or replace function public.notification_account_type(p_type text, p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when p_type in ('copy_opened', 'copy_closed', 'auto_stop_copy', 'followed_trade_opened', 'followed_trade_closed', 'loss_alert')
      then coalesce((select account_type from public.profiles where id = p_user), 'demo')
    when p_type like 'wallet\_%' then 'real'
    else null
  end
$$;

-- Set (threshold 1..90) or remove (null / 0) the alert for one copy, or for the whole portfolio
-- when p_provider_id is null.
create or replace function public.set_loss_alert(p_provider_id uuid, p_threshold numeric)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_updated integer;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if p_threshold is null or p_threshold <= 0 then
    delete from loss_alert_rules
    where user_id = v_uid and provider_id is not distinct from p_provider_id;
    return;
  end if;

  if p_threshold < 1 or p_threshold > 90 then
    raise exception 'invalid_threshold' using errcode = '22023';
  end if;

  if p_provider_id is not null
     and not exists (select 1 from subscriptions where follower_id = v_uid and provider_id = p_provider_id and is_active) then
    raise exception 'no_active_copy' using errcode = '22023';
  end if;

  update loss_alert_rules
  set threshold_pct = p_threshold, active = true, breached = false, updated_at = now()
  where user_id = v_uid and provider_id is not distinct from p_provider_id;
  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    insert into loss_alert_rules (user_id, provider_id, threshold_pct) values (v_uid, p_provider_id, p_threshold);
  end if;
end;
$function$;
revoke all on function public.set_loss_alert(uuid, numeric) from public, anon;
grant execute on function public.set_loss_alert(uuid, numeric) to authenticated;

-- Loss of one active copy, in % of the amount allocated to it: closed results of the copy (the same
-- history the automatic loss limit sums) plus its floating result.
create or replace function public.evaluate_loss_alerts()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r record;
  v_sent integer := 0;
begin
  for r in
    with rules as (
      select * from loss_alert_rules where active
    ),
    acct as (
      select p.id, p.account_type, p.balance
      from profiles p
      where p.id in (select user_id from rules)
    ),
    pos as (
      select sp.follower_id, sp.subscription_id, sp.status, coalesce(sp.pnl, 0) as pnl,
             case when sp.status = 'open' and mp.price is not null and sp.entry_price > 0
                  then ((mp.price - sp.entry_price) / sp.entry_price) * (case when sg.side = 'sell' then -1 else 1 end) * sp.size
                  else 0 end as upl
      from simulated_positions sp
      join acct a on a.id = sp.follower_id and sp.account_type = a.account_type
      join signals sg on sg.id = sp.signal_id
      left join market_prices mp on mp.symbol = sg.symbol
    ),
    copy_result as (
      select s.follower_id, s.provider_id, s.allocated_amount,
             coalesce(sum(p.pnl) filter (where p.status = 'closed'), 0) + coalesce(sum(p.upl) filter (where p.status = 'open'), 0) as result
      from subscriptions s
      left join pos p on p.subscription_id = s.id
      where s.is_active and s.follower_id in (select user_id from rules)
      group by s.id, s.follower_id, s.provider_id, s.allocated_amount
    ),
    port_result as (
      select a.id as user_id,
             coalesce((select sum(pnl) + sum(upl) from pos where pos.follower_id = a.id), 0) as result,
             a.balance - coalesce((select sum(w.amount) from wallet_transactions w
                                   where w.user_id = a.id and w.account_type = a.account_type and w.type in ('pnl', 'fee')), 0) as net_invested
      from acct a
    )
    select ru.id, ru.user_id, ru.provider_id, ru.threshold_pct, ru.breached, a.account_type,
           case
             when ru.provider_id is null then
               case when pr.net_invested > 0 then greatest(0, -pr.result) / pr.net_invested * 100 end
             else
               case when cr.allocated_amount > 0 then greatest(0, -cr.result) / cr.allocated_amount * 100 end
           end as loss_pct,
           (select coalesce(pf.display_name, pv.display_name)
            from providers pv left join profiles pf on pf.id = pv.user_id
            where pv.id = ru.provider_id) as provider_name
    from rules ru
    join acct a on a.id = ru.user_id
    left join port_result pr on pr.user_id = ru.user_id and ru.provider_id is null
    left join copy_result cr on cr.follower_id = ru.user_id and cr.provider_id = ru.provider_id
  loop
    if r.loss_pct is null then
      -- no active copy / nothing invested: nothing to watch, re-arm
      if r.breached then
        update loss_alert_rules set breached = false, updated_at = now() where id = r.id;
      end if;
    elsif r.loss_pct >= r.threshold_pct and not r.breached then
      insert into notifications (user_id, type, title, body, data, account_type)
      values (
        r.user_id,
        'loss_alert',
        'تنبيه خسارة',
        case when r.provider_id is null
             then 'وصلت خسارة محفظتك إلى ' || round(r.loss_pct, 1) || '% (حد التنبيه ' || r.threshold_pct || '%).'
             else 'وصلت خسارة نسخك لـ ' || coalesce(r.provider_name, 'متداول') || ' إلى ' || round(r.loss_pct, 1) || '% (حد التنبيه ' || r.threshold_pct || '%).' end,
        jsonb_build_object(
          'scope', case when r.provider_id is null then 'portfolio' else 'copy' end,
          'providerName', coalesce(r.provider_name, ''),
          'thresholdPct', r.threshold_pct,
          'lossPct', round(r.loss_pct, 1)
        ),
        r.account_type
      );
      update loss_alert_rules set breached = true, last_alerted_at = now(), updated_at = now() where id = r.id;
      v_sent := v_sent + 1;
    elsif r.loss_pct < r.threshold_pct and r.breached then
      update loss_alert_rules set breached = false, updated_at = now() where id = r.id;
    end if;
  end loop;
  return v_sent;
end;
$function$;
revoke all on function public.evaluate_loss_alerts() from public, anon, authenticated;
grant execute on function public.evaluate_loss_alerts() to service_role;

do $$
begin
  perform cron.unschedule('evaluate-loss-alerts')
  where exists (select 1 from cron.job where jobname = 'evaluate-loss-alerts');
  perform cron.schedule('evaluate-loss-alerts', '* * * * *', 'select public.evaluate_loss_alerts()');
exception when others then
  raise notice 'pg_cron not available, loss alerts are not scheduled: %', sqlerrm;
end $$;

commit;
