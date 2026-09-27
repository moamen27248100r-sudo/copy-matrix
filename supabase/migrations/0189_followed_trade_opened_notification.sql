-- Adds the missing "a leader you follow opened a trade" notification.
-- followed_trade_closed already existed (0166/0168); there was no
-- equivalent on open, only copy_opened for paying copiers. Live
-- definition of mirror_signal_to_followers() pulled via
-- pg_get_functiondef() before editing (per project convention) --
-- everything above the new block is unchanged from what's live today.

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
  select new.id, sub.id, sub.follower_id, new.entry_price, p.balance
  from public.subscriptions sub
  join public.profiles p on p.id = sub.follower_id
  where sub.provider_id = new.provider_id
    and sub.is_active = true
    and p.balance > 0;

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
