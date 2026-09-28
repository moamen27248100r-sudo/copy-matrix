-- Follow-up to 0193: sizing every mirrored position at the FULL
-- allocated_amount is still wrong once a leader has more than one
-- position open at a time -- two concurrent trades would mirror as two
-- positions each sized at the full allocation, so total open exposure for
-- that one copy could exceed what the customer actually allocated to it.
-- This caps each new mirrored position at whatever headroom remains
-- (allocated_amount minus the sum of that subscription's currently-open
-- position sizes), and skips mirroring entirely for a subscription with no
-- headroom left -- so cumulative open exposure per subscription can never
-- exceed its allocated_amount. Live definition of
-- mirror_signal_to_followers() pulled via pg_get_functiondef() before
-- editing (per project convention) -- everything except the changed
-- insert...select is unchanged from 0193.
CREATE OR REPLACE FUNCTION public.mirror_signal_to_followers()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_provider_name text;
begin
  if new.created_by_admin then
    return new;
  end if;

  insert into public.simulated_positions (signal_id, subscription_id, follower_id, entry_price, size)
  select
    new.id,
    sub.id,
    sub.follower_id,
    new.entry_price,
    sub.allocated_amount - coalesce(open_totals.total_open, 0) as remaining
  from public.subscriptions sub
  left join lateral (
    select coalesce(sum(sp.size), 0) as total_open
    from public.simulated_positions sp
    where sp.subscription_id = sub.id and sp.status = 'open'
  ) open_totals on true
  where sub.provider_id = new.provider_id
    and sub.is_active = true
    and sub.allocated_amount > coalesce(open_totals.total_open, 0);

  if exists (select 1 from public.follows where provider_id = new.provider_id) then
    select coalesce(pr.display_name, p.display_name) into v_provider_name
    from public.providers p
    left join public.profiles pr on pr.id = p.user_id
    where p.id = new.provider_id;

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
    where f.provider_id = new.provider_id;
  end if;

  return new;
end;
$function$;
