-- 0266: price alerts
--
-- A customer sets a target price on an instrument; the alert fires once when the live price
-- reaches it (from below for "above", from above for "below" -- the direction is fixed at creation
-- from the price at that moment) and becomes a notification of type market_price_alert (category
-- 'market': on in the app by default and switchable, like the big-move notices; the push / email
-- queues follow the usual preferences).
--   * price_alerts: the customer's own rows, readable by them only; written only through
--     create_price_alert / cancel_price_alert (at most 20 active alerts each).
--   * evaluate_price_alerts(): every minute (pg_cron), against market_prices (updated every 10 s).
-- Rollback: supabase/rollback/0266_price_alerts.sql

begin;

create table public.price_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  symbol text not null,
  direction text not null check (direction in ('above', 'below')),
  target_price numeric not null check (target_price > 0),
  created_price numeric not null check (created_price > 0),
  status text not null default 'active' check (status in ('active', 'triggered', 'cancelled')),
  created_at timestamptz not null default now(),
  triggered_at timestamptz,
  triggered_price numeric
);
create index price_alerts_active_idx on public.price_alerts (symbol) where status = 'active';
create index price_alerts_user_idx on public.price_alerts (user_id, created_at desc);

alter table public.price_alerts enable row level security;
create policy price_alerts_select_own on public.price_alerts for select to authenticated using (user_id = auth.uid());
revoke all on public.price_alerts from anon, authenticated;
grant select on public.price_alerts to authenticated;

create or replace function public.create_price_alert(p_symbol text, p_target numeric)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_price numeric;
  v_id uuid;
begin
  if v_user is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select price into v_price from public.market_prices where symbol = p_symbol;
  if v_price is null or v_price <= 0 then raise exception 'unknown_symbol' using errcode = 'CM060'; end if;
  if p_target is null or p_target <= 0 then raise exception 'invalid_target' using errcode = 'CM061'; end if;
  if p_target = v_price then raise exception 'target_is_current_price' using errcode = 'CM062'; end if;
  if (select count(*) from public.price_alerts where user_id = v_user and status = 'active') >= 20 then
    raise exception 'too_many_alerts' using errcode = 'CM063';
  end if;
  insert into public.price_alerts (user_id, symbol, direction, target_price, created_price)
  values (v_user, p_symbol, case when p_target > v_price then 'above' else 'below' end, p_target, v_price)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.create_price_alert(text, numeric) from public, anon;
grant execute on function public.create_price_alert(text, numeric) to authenticated;

create or replace function public.cancel_price_alert(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.price_alerts set status = 'cancelled'
  where id = p_id and user_id = auth.uid() and status = 'active';
end $$;
revoke all on function public.cancel_price_alert(uuid) from public, anon;
grant execute on function public.cancel_price_alert(uuid) to authenticated;

create or replace function public.evaluate_price_alerts()
returns integer language plpgsql security definer set search_path = public as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    update public.price_alerts a
    set status = 'triggered', triggered_at = now(), triggered_price = m.price
    from public.market_prices m
    where a.status = 'active' and m.symbol = a.symbol and m.price > 0
      and ((a.direction = 'above' and m.price >= a.target_price) or (a.direction = 'below' and m.price <= a.target_price))
    returning a.user_id, a.symbol, a.direction, a.target_price, m.price
  loop
    insert into public.notifications (user_id, type, title, body, data)
    values (r.user_id, 'market_price_alert', 'تنبيه سعر ' || r.symbol, null,
      jsonb_build_object('symbol', r.symbol, 'direction', r.direction, 'target', r.target_price, 'price', r.price));
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.evaluate_price_alerts() from public, anon, authenticated;

select cron.schedule('evaluate-price-alerts', '* * * * *', 'select public.evaluate_price_alerts()');

commit;
