-- 0263: copied trades sized by margin, like the leader's own trade; no trade is skipped silently.
-- Rollback: supabase/rollback/0263_copy_margin_sizing.sql
--
-- Before: in "ratio" mode every copied trade took ALL of the copy's remaining amount, so while one
-- copied trade was open the leader's next trades found nothing free and were skipped without a word.
--
-- Now, for every active copy of the leader:
--   margin of the copied trade = (leader's margin in the trade / leader's balance) x amount of the copy
--   the copied trade uses the leader's leverage: exposure (simulated_positions.size) = margin x leverage
--   (results stay a percentage of the whole, the same as the leader's trade).
--   * not enough free amount for the full margin  -> opened with what is free, the customer is told
--   * free amount (or the full margin) below the minimum trade (US$10 exposure) -> not opened,
--     the customer is told
--   every reduced or skipped trade is recorded in copy_events with its reason.
-- Take profit / stop loss / trailing stay percentages of the margin, so their price distance is
-- divided by the leverage. Positions opened before this migration keep leverage 1 and margin = size.

begin;

-- 1. Margin and leverage of each copied trade -------------------------------------------------------
alter table public.simulated_positions
  add column if not exists margin numeric,
  add column if not exists leverage numeric not null default 1;
update public.simulated_positions set margin = size where margin is null;
alter table public.simulated_positions add constraint simulated_positions_leverage_check check (leverage >= 1);
grant select (margin, leverage) on public.simulated_positions to authenticated;

-- 2. Reduced / skipped copies, with the reason --------------------------------------------------------
create table if not exists public.copy_events (
  id bigint generated always as identity primary key,
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  follower_id uuid not null references public.profiles(id) on delete cascade,
  signal_id uuid references public.signals(id) on delete set null,
  symbol text not null,
  kind text not null check (kind in ('reduced', 'skipped')),
  reason text not null check (reason in ('insufficient_free_amount', 'below_minimum_size')),
  required_margin numeric not null,
  available_margin numeric not null,
  opened_margin numeric,
  created_at timestamptz not null default now()
);
create index if not exists copy_events_follower_idx on public.copy_events (follower_id, created_at desc);
create index if not exists copy_events_subscription_idx on public.copy_events (subscription_id, created_at desc);
alter table public.copy_events enable row level security;
drop policy if exists copy_events_select_own on public.copy_events;
create policy copy_events_select_own on public.copy_events for select to authenticated using (follower_id = (select auth.uid()));
revoke all on public.copy_events from anon, authenticated;
grant select on public.copy_events to authenticated;

-- 3. The leader's margin share and leverage for a trade -----------------------------------------------
create or replace function public.copy_min_exposure()
returns numeric language sql immutable as $$ select 10::numeric $$;

create or replace function public.copy_leader_margin(p_signal_id uuid, out ratio numeric, out leverage numeric)
language sql stable security definer set search_path = public as $$
  with s as (
    select g.symbol, g.lot_size, g.entry_price, p.account_capital, p.persona, p.user_id
    from public.signals g join public.providers p on p.id = g.provider_id
    where g.id = p_signal_id
  ), v as (
    select coalesce(public.sim_notional(s.symbol, s.lot_size, s.entry_price), s.lot_size * s.entry_price) as notional,
           case when s.persona ? 'lev' then greatest(1, (s.persona ->> 'lev')::numeric) else 1 end as lev,
           coalesce(nullif(s.account_capital, 0), (select pr.balance from public.profiles pr where pr.id = s.user_id)) as equity
    from s
  )
  -- Without a known size or balance (a manual trade with no lot), a tenth of the copy is used.
  select case when v.notional > 0 and v.equity > 0 then least(1, v.notional / v.lev / v.equity) else 0.1 end, v.lev
  from v
$$;

-- 4. How much of a copy goes into one trade --------------------------------------------------------------
create or replace function public.copy_trade_size(
  p_subscription_id uuid, p_ratio numeric, p_leverage numeric,
  out margin numeric, out kind text, out reason text, out required numeric, out available numeric)
language plpgsql stable security definer set search_path = public as $$
declare
  v_sub record;
  v_open numeric;
  v_lev numeric := greatest(1, coalesce(p_leverage, 1));
begin
  select allocated_amount, copy_mode, fixed_amount, max_per_trade into v_sub
    from public.subscriptions where id = p_subscription_id;
  select coalesce(sum(coalesce(sp.margin, sp.size)), 0) into v_open
    from public.simulated_positions sp where sp.subscription_id = p_subscription_id and sp.status = 'open';
  available := round(greatest(0, v_sub.allocated_amount - v_open), 2);
  required := case when v_sub.copy_mode = 'fixed' and v_sub.fixed_amount is not null then v_sub.fixed_amount
                   else v_sub.allocated_amount * coalesce(p_ratio, 0) end;
  if v_sub.max_per_trade is not null then required := least(required, v_sub.max_per_trade); end if;
  required := round(required, 2);

  if required * v_lev < public.copy_min_exposure() then
    margin := 0; kind := 'skipped'; reason := 'below_minimum_size';
  elsif required <= available then
    margin := required; kind := 'full'; reason := null;
  elsif available * v_lev >= public.copy_min_exposure() then
    margin := available; kind := 'reduced'; reason := 'insufficient_free_amount';
  else
    margin := 0; kind := 'skipped'; reason := 'insufficient_free_amount';
  end if;
end $$;

-- 5. Record a reduced / skipped copy and tell the customer -----------------------------------------------
create or replace function public.copy_record_event(
  p_subscription_id uuid, p_follower_id uuid, p_signal_id uuid, p_symbol text, p_side text, p_provider_name text,
  p_kind text, p_reason text, p_required numeric, p_available numeric, p_opened numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.copy_events (subscription_id, follower_id, signal_id, symbol, kind, reason, required_margin, available_margin, opened_margin)
  values (p_subscription_id, p_follower_id, p_signal_id, p_symbol, p_kind, p_reason, p_required, p_available, p_opened);

  insert into public.notifications (user_id, type, title, body, data)
  values (
    p_follower_id,
    case when p_kind = 'reduced' then 'copy_reduced' else 'copy_skipped' end,
    case when p_kind = 'reduced' then 'نُسخت صفقة بمبلغ أقل' else 'لم تُنسخ صفقة' end,
    case when p_kind = 'reduced'
      then 'نُسخت صفقة ' || p_symbol || ' من ' || p_provider_name || ' بمبلغ ' || round(p_opened, 2) || '$ بدل ' || round(p_required, 2) || '$ لأن المتاح في النسخ ' || round(p_available, 2) || '$.'
      else 'لم تُنسخ صفقة ' || p_symbol || ' من ' || p_provider_name || ' لأن ' ||
        case when p_reason = 'below_minimum_size' then 'حجمها أقل من الحد الأدنى للصفقة.' else 'المبلغ المتاح في النسخ لا يكفي.' end
    end,
    jsonb_build_object(
      'providerName', p_provider_name,
      'symbol', p_symbol,
      'side', p_side,
      'reason', p_reason,
      'required', round(p_required, 2),
      'available', round(p_available, 2),
      'opened', round(coalesce(p_opened, 0), 2)
    )
  );
end $$;

revoke execute on function public.copy_leader_margin(uuid) from public, anon, authenticated;
revoke execute on function public.copy_trade_size(uuid, numeric, numeric) from public, anon, authenticated;
revoke execute on function public.copy_record_event(uuid, uuid, uuid, text, text, text, text, text, numeric, numeric, numeric) from public, anon, authenticated;

-- 6. The copy trigger, the copy start, the totals, the TP/SL update, the notice categories ----------------
CREATE OR REPLACE FUNCTION public.mirror_signal_to_followers()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_provider_name text;
  v_copiers uuid[] := '{}';
  v_simulated boolean;
  v_ratio numeric;
  v_lev numeric;
  v_sub record;
  v_cs record;
begin
  if new.created_by_admin then
    return new;
  end if;

  select coalesce(pr.display_name, p.display_name), p.is_simulated and not public.sim_leaders_open_to_real()
    into v_provider_name, v_simulated
  from public.providers p
  left join public.profiles pr on pr.id = p.user_id
  where p.id = new.provider_id;

  -- Every active copy gets the trade, sized by the leader's margin share of their balance (0263).
  select r.ratio, r.leverage into v_ratio, v_lev from public.copy_leader_margin(new.id) r;

  for v_sub in
    select sub.id, sub.follower_id, sub.tp_pct, sub.sl_pct, sub.trailing_pct
    from public.subscriptions sub
    where sub.provider_id = new.provider_id
      and sub.is_active = true
      -- While closed to real accounts, a simulated leader's trades are only copied into demo accounts.
      and (not v_simulated or exists (
        select 1 from public.profiles fp where fp.id = sub.follower_id and fp.account_type = 'demo'))
    order by sub.created_at
  loop
    select * into v_cs from public.copy_trade_size(v_sub.id, v_ratio, v_lev);

    if v_cs.kind = 'skipped' then
      perform public.copy_record_event(v_sub.id, v_sub.follower_id, new.id, new.symbol, new.side,
        coalesce(v_provider_name, 'متداول'), 'skipped', v_cs.reason, v_cs.required, v_cs.available, null);
      continue;
    end if;

    insert into public.simulated_positions
      (signal_id, subscription_id, follower_id, entry_price, size, margin, leverage, take_profit, stop_loss, trail_pct, best_price)
    values
      (new.id, v_sub.id, v_sub.follower_id, new.entry_price, round(v_cs.margin * v_lev, 2), v_cs.margin, v_lev,
       public.copy_tp_price(new.side, new.entry_price, v_sub.tp_pct / v_lev),
       public.copy_sl_price(new.side, new.entry_price, v_sub.sl_pct / v_lev),
       v_sub.trailing_pct / v_lev,
       case when v_sub.trailing_pct is not null then new.entry_price end);

    insert into public.notifications (user_id, type, title, body, data)
    values (
      v_sub.follower_id,
      'copy_opened',
      'تم نسخ صفقة جديدة',
      'نُسخت صفقة ' || (case when new.side = 'sell' then 'بيع' else 'شراء' end) || ' على زوج ' || new.symbol ||
        ' من ' || coalesce(v_provider_name, 'متداول') || ' إلى حسابك.',
      jsonb_build_object(
        'providerName', coalesce(v_provider_name, 'متداول'),
        'symbol', new.symbol,
        'side', new.side,
        'size', v_cs.margin,
        'price', new.entry_price
      )
    );

    if v_cs.kind = 'reduced' then
      perform public.copy_record_event(v_sub.id, v_sub.follower_id, new.id, new.symbol, new.side,
        coalesce(v_provider_name, 'متداول'), 'reduced', v_cs.reason, v_cs.required, v_cs.available, v_cs.margin);
    end if;

    v_copiers := v_copiers || v_sub.follower_id;
  end loop;

  if exists (select 1 from public.follows where provider_id = new.provider_id) then
    insert into public.notifications (user_id, type, title, body, data)
    select
      f.follower_id,
      'followed_trade_opened',
      'فتح صفقة جديدة | ' || coalesce(v_provider_name, 'متداول'),
      'قام ' || coalesce(v_provider_name, 'متداول') || ' بفتح صفقة ' ||
        (case when new.side = 'sell' then 'بيع' else 'شراء' end) || ' على زوج ' || new.symbol ||
        '. يمكنك مراجعة التفاصيل الآن.',
      jsonb_build_object(
        'providerName', coalesce(v_provider_name, 'متداول'),
        'symbol', new.symbol,
        'side', new.side
      )
    from public.follows f
    where f.provider_id = new.provider_id
      and f.follower_id <> all (v_copiers)
      and (not v_simulated or exists (
        select 1 from public.profiles fp where fp.id = f.follower_id and fp.account_type = 'demo'));
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.start_or_update_copy(p_provider_id uuid, p_allocated_amount numeric, p_copy_mode text DEFAULT 'ratio'::text, p_fixed_amount numeric DEFAULT NULL::numeric, p_max_per_trade numeric DEFAULT NULL::numeric, p_stop_loss_pct numeric DEFAULT NULL::numeric, p_tp_pct numeric DEFAULT NULL::numeric, p_sl_pct numeric DEFAULT NULL::numeric, p_trailing_pct numeric DEFAULT NULL::numeric, p_copy_open boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_balance numeric;
  v_min_copy_amount numeric;
  v_trading_status text;
  v_other_allocated numeric;
  v_existing_id uuid;
  v_existing_started_at timestamptz;
  v_is_starting boolean;
  v_new_started_at timestamptz;
  v_mode text := coalesce(p_copy_mode, 'ratio');
  v_fixed numeric;
  v_max_per_trade numeric;
  v_stop_loss numeric := coalesce(p_stop_loss_pct, 50);
  v_sub_id uuid;
  v_sig record;
  v_open_total numeric;
  v_size numeric;
  v_provider_name text;
  v_ratio numeric;
  v_lev numeric;
  v_cs record;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  -- Two simultaneous submits (double click, second tab) must not both count as "starting".
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':' || p_provider_id::text, 0));

  if p_allocated_amount is null or p_allocated_amount <= 0 then
    raise exception 'invalid_amount' using errcode = 'CM001';
  end if;

  if v_mode not in ('ratio', 'fixed') then
    raise exception 'invalid_copy_settings' using errcode = 'CM017';
  end if;
  v_fixed := case when v_mode = 'fixed' then p_fixed_amount else null end;
  if v_mode = 'fixed' and (v_fixed is null or v_fixed <= 0 or v_fixed > p_allocated_amount) then
    raise exception 'invalid_copy_settings' using errcode = 'CM017';
  end if;
  v_max_per_trade := p_max_per_trade;
  if v_max_per_trade is not null and (v_max_per_trade <= 0 or v_max_per_trade > p_allocated_amount) then
    raise exception 'invalid_copy_settings' using errcode = 'CM017';
  end if;
  if v_stop_loss < 1 or v_stop_loss > 90 then
    raise exception 'invalid_copy_settings' using errcode = 'CM017';
  end if;
  perform public.validate_copy_risk(p_tp_pct, p_sl_pct, p_trailing_pct);

  select balance into v_balance from public.profiles where id = auth.uid() for update;
  select min_copy_amount, trading_status into v_min_copy_amount, v_trading_status
    from public.providers where id = p_provider_id;

  if v_min_copy_amount is null then
    raise exception 'provider_not_found' using errcode = 'CM002';
  end if;

  if v_trading_status = 'stopped' then
    raise exception 'trader_stopped' using errcode = 'CM003';
  end if;

  -- Leader / account visibility rules live in copy_check_leader_account (driven by deposits_enabled).
  perform public.copy_check_leader_account(p_provider_id, auth.uid());

  select id, copy_started_at into v_existing_id, v_existing_started_at
    from public.subscriptions
    where follower_id = auth.uid() and provider_id = p_provider_id and is_active = true;

  v_is_starting := v_existing_id is null;

  -- A leader who is not accepting followers takes no new copiers (existing copies keep running).
  if v_is_starting and exists (
    select 1 from public.lead_trader_profiles ltp
    where ltp.provider_id = p_provider_id and ltp.accepting_followers = false
  ) then
    raise exception 'not_accepting_followers' using errcode = 'CM051';
  end if;

  -- With deposits switched on, a real account needs an approved KYC to start a copy.
  if v_is_starting and public.deposits_enabled()
     and exists (select 1 from public.profiles where id = auth.uid() and account_type = 'real')
     and not public.kyc_is_approved(auth.uid()) then
    raise exception 'kyc_required' using errcode = 'CM052';
  end if;

  if v_is_starting and exists (
    select 1 from public.lead_trader_profiles ltp
    where ltp.provider_id = p_provider_id and ltp.whitelist_enabled
  ) and not exists (
    select 1 from public.follower_invites fi
    where fi.provider_id = p_provider_id and fi.used_by = auth.uid()
  ) then
    raise exception 'not_invited' using errcode = 'CM008';
  end if;

  -- While a copied trade is open the amount, mode, per-trade cap and copy stop-loss are locked;
  -- take profit / stop loss / trailing stay editable. With nothing open everything is editable.
  if not v_is_starting and exists (
    select 1 from public.simulated_positions where subscription_id = v_existing_id and status = 'open'
  ) and exists (
    select 1 from public.subscriptions s
    where s.id = v_existing_id
      and (s.allocated_amount is distinct from p_allocated_amount
        or s.copy_mode is distinct from v_mode
        or s.fixed_amount is distinct from v_fixed
        or s.max_per_trade is distinct from v_max_per_trade
        or s.max_drawdown_pct is distinct from v_stop_loss)
  ) then
    raise exception 'copy_locked_open_positions' using errcode = 'CM004';
  end if;

  select coalesce(sum(allocated_amount), 0) into v_other_allocated
    from public.subscriptions
    where follower_id = auth.uid() and is_active = true and provider_id <> p_provider_id;

  if p_allocated_amount > coalesce(v_balance, 0) - v_other_allocated then
    raise exception 'exceeds_balance' using errcode = 'CM006';
  end if;

  if p_allocated_amount < v_min_copy_amount then
    raise exception 'below_minimum' using errcode = 'CM007';
  end if;

  v_new_started_at := case when v_is_starting then now() else v_existing_started_at end;

  insert into public.subscriptions
    (follower_id, provider_id, is_active, allocated_amount, max_drawdown_pct, copy_started_at,
     copy_mode, fixed_amount, max_per_trade, tp_pct, sl_pct, trailing_pct)
  values
    (auth.uid(), p_provider_id, true, p_allocated_amount, v_stop_loss, v_new_started_at,
     v_mode, v_fixed, v_max_per_trade, p_tp_pct, p_sl_pct, p_trailing_pct)
  on conflict (follower_id, provider_id) do update
    set is_active = true,
        allocated_amount = p_allocated_amount,
        max_drawdown_pct = v_stop_loss,
        copy_started_at = v_new_started_at,
        copy_mode = v_mode,
        fixed_amount = v_fixed,
        max_per_trade = v_max_per_trade,
        tp_pct = p_tp_pct,
        sl_pct = p_sl_pct,
        trailing_pct = p_trailing_pct
  returning id into v_sub_id;

  -- Copy the leader's trades that are open right now, at the current market
  -- price, sized exactly like a freshly mirrored trade.
  if v_is_starting and coalesce(p_copy_open, false) then
    select coalesce(pr.display_name, p.display_name) into v_provider_name
    from public.providers p
    left join public.profiles pr on pr.id = p.user_id
    where p.id = p_provider_id;

    for v_sig in
      select s.id, s.side, s.symbol, mp.price
      from public.signals s
      join public.market_prices mp on mp.symbol = s.symbol
      where s.provider_id = p_provider_id
        and s.status = 'open'
        and coalesce(s.hidden, false) = false
        and not s.created_by_admin
        and mp.price is not null and mp.price > 0
      order by s.opened_at
    loop
      -- Same sizing as a freshly mirrored trade: the leader's margin share of their balance,
      -- applied to this copy's amount, at the leader's leverage (migration 0263).
      select r.ratio, r.leverage into v_ratio, v_lev from public.copy_leader_margin(v_sig.id) r;
      select * into v_cs from public.copy_trade_size(v_sub_id, v_ratio, v_lev);
      if v_cs.kind = 'skipped' then
        perform public.copy_record_event(v_sub_id, auth.uid(), v_sig.id, v_sig.symbol, v_sig.side,
          coalesce(v_provider_name, 'متداول'), 'skipped', v_cs.reason, v_cs.required, v_cs.available, null);
        continue;
      end if;

      insert into public.simulated_positions
        (signal_id, subscription_id, follower_id, entry_price, size, margin, leverage, take_profit, stop_loss, trail_pct, best_price)
      values
        (v_sig.id, v_sub_id, auth.uid(), v_sig.price, round(v_cs.margin * v_lev, 2), v_cs.margin, v_lev,
         public.copy_tp_price(v_sig.side, v_sig.price, p_tp_pct / v_lev),
         public.copy_sl_price(v_sig.side, v_sig.price, p_sl_pct / v_lev),
         p_trailing_pct / v_lev,
         case when p_trailing_pct is not null then v_sig.price end);

      insert into public.notifications (user_id, type, title, body, data)
      values (
        auth.uid(),
        'copy_opened',
        'تم نسخ صفقة جديدة',
        'نُسخت صفقة ' || (case when v_sig.side = 'sell' then 'بيع' else 'شراء' end) || ' على زوج ' || v_sig.symbol ||
          ' من ' || coalesce(v_provider_name, 'متداول') || ' إلى حسابك.',
        jsonb_build_object(
          'providerName', coalesce(v_provider_name, 'متداول'),
          'symbol', v_sig.symbol,
          'side', v_sig.side,
          'size', v_cs.margin,
          'price', v_sig.price
        )
      );
      if v_cs.kind = 'reduced' then
        perform public.copy_record_event(v_sub_id, auth.uid(), v_sig.id, v_sig.symbol, v_sig.side,
          coalesce(v_provider_name, 'متداول'), 'reduced', v_cs.reason, v_cs.required, v_cs.available, v_cs.margin);
      end if;
    end loop;
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.dashboard_summary(p_tz text DEFAULT 'UTC'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    select sp.id, sp.subscription_id, sp.status, coalesce(sp.pnl, 0) as pnl, sp.size, coalesce(sp.margin, sp.size) as margin, sp.closed_at,
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
      'invested', coalesce(sum(margin), 0)
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
             sum(margin + upl) as val
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
$function$
;

CREATE OR REPLACE FUNCTION public.update_copy_risk_settings(p_provider_id uuid, p_tp_pct numeric, p_sl_pct numeric, p_trailing_pct numeric, p_apply_to_open boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_sub_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  perform public.validate_copy_risk(p_tp_pct, p_sl_pct, p_trailing_pct);

  select id into v_sub_id from public.subscriptions
    where follower_id = auth.uid() and provider_id = p_provider_id and is_active = true for update;
  if v_sub_id is null then
    raise exception 'copy_not_found' using errcode = 'CM021';
  end if;

  update public.subscriptions
    set tp_pct = p_tp_pct, sl_pct = p_sl_pct, trailing_pct = p_trailing_pct
    where id = v_sub_id;

  if coalesce(p_apply_to_open, false) then
    update public.simulated_positions sp
      set take_profit = public.copy_tp_price(s.side, sp.entry_price, p_tp_pct / sp.leverage),
          stop_loss = public.copy_sl_price(s.side, sp.entry_price, p_sl_pct / sp.leverage),
          trail_pct = p_trailing_pct / sp.leverage,
          best_price = case when p_trailing_pct is null then null
                            else coalesce(mp.price, sp.entry_price) end
      from public.signals s
      left join public.market_prices mp on mp.symbol = s.symbol
      where s.id = sp.signal_id and sp.subscription_id = v_sub_id and sp.status = 'open';
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.notification_category(p_type text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case
    when p_type in ('copy_opened', 'copy_closed') then 'copy_trades'
    when p_type in ('followed_trade_opened', 'followed_trade_closed') then 'trades'
    when p_type in ('copy_started', 'copy_stopped', 'auto_stop_copy', 'loss_alert', 'leader_stopped', 'copy_reduced', 'copy_skipped') then 'copy'
    when p_type like 'market\_%' then 'market'
    when p_type like 'wallet\_%' or p_type like 'kyc\_%' then 'account'
    else 'security'
  end
$function$
;

CREATE OR REPLACE FUNCTION public.notification_account_type(p_type text, p_user uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when p_type in ('copy_opened', 'copy_closed', 'copy_started', 'copy_stopped', 'auto_stop_copy', 'leader_stopped',
                    'followed_trade_opened', 'followed_trade_closed', 'loss_alert',
                    'copy_reduced', 'copy_skipped')
      then coalesce((select account_type from public.profiles where id = p_user), 'demo')
    when p_type like 'wallet\_%' then 'real'
    else null
  end
$function$
;

commit;
