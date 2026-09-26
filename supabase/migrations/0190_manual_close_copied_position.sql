-- Lets a customer manually close one of their own open copied positions
-- from the dashboard, instead of only ever waiting for the leader's signal
-- to close (public.close_simulated_positions(), 0001/0168). Mirrors that
-- trigger's exact math (pnl = pct * size, balance += pnl, same
-- wallet_transactions + copy_closed notification shape) so a manually
-- closed position looks identical downstream to an automatically closed
-- one -- same tables, same invariants, nothing new for existing code to
-- special-case.
--
-- SECURITY DEFINER + auth.uid() ownership check, same pattern as
-- start_or_update_copy() / stop_copy() (0181): simulated_positions RLS is
-- select-only for the owning follower (0001), by design, so this is the
-- only legitimate write path -- never a direct client-side UPDATE.
create or replace function public.close_my_position(p_position_id uuid)
returns numeric
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_position record;
  v_signal record;
  v_price numeric;
  v_pnl numeric;
  v_new_balance numeric;
  v_provider_name text;
begin
  select sp.* into v_position
  from public.simulated_positions sp
  where sp.id = p_position_id
    and sp.follower_id = auth.uid()
    and sp.status = 'open'
  for update;

  if not found then
    raise exception 'position_not_found_or_closed' using errcode = 'CM010';
  end if;

  select s.symbol, s.side, s.provider_id into v_signal
  from public.signals s
  where s.id = v_position.signal_id;

  select price into v_price from public.market_prices where symbol = v_signal.symbol;
  if v_price is null then
    raise exception 'no_market_price' using errcode = 'CM011';
  end if;

  v_pnl := round((
    ((v_price - v_position.entry_price) / v_position.entry_price)
    * v_position.size
    * (case when v_signal.side = 'sell' then -1 else 1 end)
  )::numeric, 2);

  update public.simulated_positions
  set exit_price = v_price, status = 'closed', closed_at = now(), pnl = v_pnl
  where id = v_position.id;

  update public.profiles
  set balance = balance + v_pnl
  where id = auth.uid()
  returning balance into v_new_balance;

  select coalesce(pr.display_name, p.display_name) into v_provider_name
  from public.providers p
  left join public.profiles pr on pr.id = p.user_id
  where p.id = v_signal.provider_id;

  insert into public.wallet_transactions (user_id, type, amount, balance_after, note)
  values (auth.uid(), 'pnl', v_pnl, v_new_balance, 'إغلاق يدوي لصفقة منسوخة: ' || v_signal.symbol);

  insert into public.notifications (user_id, type, title, body, data)
  values (
    auth.uid(),
    'copy_closed',
    'صفقة منسوخة من ' || coalesce(v_provider_name, 'متداول'),
    'أُغلقت صفقة ' || v_signal.symbol || ' بنتيجة ' ||
      (case when v_pnl >= 0 then '+' else '' end) || v_pnl || '$',
    jsonb_build_object(
      'providerName', coalesce(v_provider_name, 'متداول'),
      'symbol', v_signal.symbol,
      'amount', abs(v_pnl),
      'positive', v_pnl >= 0
    )
  );

  return v_pnl;
end;
$function$;

grant execute on function public.close_my_position(uuid) to authenticated;
