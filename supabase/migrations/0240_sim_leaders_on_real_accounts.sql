-- Simulated leaders on real accounts too, behind one switch.
--
-- platform_settings.sim_leaders_open_to_real (on now, before launch): when on,
-- real accounts and visitors see simulated leaders and can copy / follow them
-- exactly like demo accounts, with their trades mirrored into the real
-- wallet. Turning it off restores the demo-only rules of 0234 / 0235:
--   update public.platform_settings set value = 'false' where key = 'sim_leaders_open_to_real';

begin;

create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.platform_settings enable row level security;
insert into public.platform_settings (key, value) values ('sim_leaders_open_to_real', 'true')
on conflict (key) do nothing;

create or replace function public.sim_leaders_open_to_real()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select value = 'true'::jsonb from public.platform_settings where key = 'sim_leaders_open_to_real'), false);
$$;
grant execute on function public.sim_leaders_open_to_real() to anon, authenticated;

create or replace function public.viewer_sees_simulated()
returns boolean language sql stable security definer set search_path = public as $$
  select public.sim_leaders_open_to_real()
      or coalesce(auth.role() = 'service_role', false)
      or exists (select 1 from public.profiles where id = auth.uid() and (account_type = 'demo' or is_admin));
$$;

create or replace function public.copy_check_leader_account(p_provider_id uuid, p_follower uuid)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.sim_leaders_open_to_real()
     and exists (select 1 from public.providers where id = p_provider_id and is_simulated)
     and not exists (select 1 from public.profiles where id = p_follower and account_type = 'demo') then
    raise exception 'leader_demo_only' using errcode = 'CM050';
  end if;
end $$;

create or replace function public.follows_check_visibility()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.sim_leaders_open_to_real()
     and exists (select 1 from public.providers where id = new.provider_id and is_simulated)
     and not exists (select 1 from public.profiles where id = new.follower_id and account_type = 'demo') then
    raise exception 'leader_demo_only' using errcode = 'CM050';
  end if;
  return new;
end $$;

CREATE OR REPLACE FUNCTION public.mirror_signal_to_followers()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_provider_name text;
  v_copiers uuid[];
  v_simulated boolean;
begin
  if new.created_by_admin then
    return new;
  end if;

  select coalesce(pr.display_name, p.display_name), p.is_simulated and not public.sim_leaders_open_to_real()
    into v_provider_name, v_simulated
  from public.providers p
  left join public.profiles pr on pr.id = p.user_id
  where p.id = new.provider_id;

  with ins as (
    insert into public.simulated_positions
      (signal_id, subscription_id, follower_id, entry_price, size, take_profit, stop_loss, trail_pct, best_price)
    select
      new.id,
      sub.id,
      sub.follower_id,
      new.entry_price,
      least(
        case when sub.copy_mode = 'fixed' and sub.fixed_amount is not null
             then least(sub.fixed_amount, sub.allocated_amount - coalesce(open_totals.total_open, 0))
             else sub.allocated_amount - coalesce(open_totals.total_open, 0) end,
        coalesce(sub.max_per_trade, sub.allocated_amount)
      ) as size,
      public.copy_tp_price(new.side, new.entry_price, sub.tp_pct),
      public.copy_sl_price(new.side, new.entry_price, sub.sl_pct),
      sub.trailing_pct,
      case when sub.trailing_pct is not null then new.entry_price end
    from public.subscriptions sub
    left join lateral (
      select coalesce(sum(sp.size), 0) as total_open
      from public.simulated_positions sp
      where sp.subscription_id = sub.id and sp.status = 'open'
    ) open_totals on true
    where sub.provider_id = new.provider_id
      and sub.is_active = true
      -- While closed to real accounts, a simulated leader's trades are only
      -- copied into demo accounts.
      and (not v_simulated or exists (
        select 1 from public.profiles fp where fp.id = sub.follower_id and fp.account_type = 'demo'))
      and sub.allocated_amount > coalesce(open_totals.total_open, 0)
    returning follower_id, size, entry_price
  ),
  notified as (
    insert into public.notifications (user_id, type, title, body, data)
    select
      i.follower_id,
      'copy_opened',
      'تم نسخ صفقة جديدة',
      'نُسخت صفقة ' || (case when new.side = 'sell' then 'بيع' else 'شراء' end) || ' على زوج ' || new.symbol ||
        ' من ' || coalesce(v_provider_name, 'متداول') || ' إلى حسابك.',
      jsonb_build_object(
        'providerName', coalesce(v_provider_name, 'متداول'),
        'symbol', new.symbol,
        'side', new.side,
        'size', i.size,
        'price', i.entry_price
      )
    from ins i
  )
  select coalesce(array_agg(follower_id), '{}') into v_copiers from ins;

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

CREATE OR REPLACE FUNCTION public.close_simulated_positions()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_position_id uuid;
  v_provider_name text;
  v_pct numeric;
  v_follower_id uuid;
  v_copiers uuid[];
begin
  if new.status = 'closed' and old.status = 'open' then
    select coalesce(array_agg(distinct follower_id), '{}') into v_copiers
    from public.simulated_positions where signal_id = new.id and status = 'open';

    for v_position_id in
      select id from public.simulated_positions
      where signal_id = new.id and status = 'open'
    loop
      perform public.settle_copied_position(v_position_id, new.exit_price, now(), 'leader');
    end loop;

    if exists (select 1 from public.follows where provider_id = new.provider_id) then
      select coalesce(pr.display_name, p.display_name) into v_provider_name
      from public.providers p
      left join public.profiles pr on pr.id = p.user_id
      where p.id = new.provider_id;

      v_pct := round(
        (((new.exit_price - new.entry_price) / new.entry_price)
          * (case when new.side = 'sell' then -1 else 1 end) * 100)::numeric,
        2
      );

      -- Someone who copied the trade already got the copy_closed notice.
      for v_follower_id in
        select fo.follower_id from public.follows fo
        where fo.provider_id = new.provider_id and fo.follower_id <> all (v_copiers)
          and (public.sim_leaders_open_to_real()
               or not exists (select 1 from public.providers sp where sp.id = new.provider_id and sp.is_simulated)
               or exists (select 1 from public.profiles fp where fp.id = fo.follower_id and fp.account_type = 'demo'))
      loop
        insert into public.notifications (user_id, type, title, body, data)
        values (
          v_follower_id,
          'followed_trade_closed',
          'صفقة جديدة من متداول تتابعه',
          coalesce(v_provider_name, 'متداول') || ' أغلق صفقة ' || new.symbol || ' بنتيجة ' ||
            (case when v_pct >= 0 then '+' else '' end) || v_pct || '%',
          jsonb_build_object(
            'providerName', coalesce(v_provider_name, 'متداول'),
            'symbol', new.symbol,
            'pct', abs(v_pct),
            'positive', v_pct >= 0
          )
        );
      end loop;
    end if;
  end if;
  return new;
end;
$function$;

commit;
