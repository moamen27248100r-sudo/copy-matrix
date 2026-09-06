-- Tighten the stop_copy blocked-message wording: drop the redundant
-- Arabic translation next to the English "Margin" term, and drop the
-- "(win or loss)" aside — cleaner, closer to how real platforms word it.
create or replace function public.stop_copy(p_provider_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subscription_id uuid;
  v_has_open_positions boolean;
begin
  select id into v_subscription_id
  from public.subscriptions
  where follower_id = auth.uid() and provider_id = p_provider_id and is_active = true;

  if v_subscription_id is null then
    return;
  end if;

  select exists (
    select 1 from public.simulated_positions
    where subscription_id = v_subscription_id and status = 'open'
  ) into v_has_open_positions;

  if v_has_open_positions then
    raise exception 'تعذّر إيقاف النسخ حالياً: يوجد لديك صفقات مفتوحة على هذا الحساب، ورصيدك محجوز حالياً كـ Margin لتغطيتها. يمكنك إعادة المحاولة بعد إغلاق جميع الصفقات المفتوحة.';
  end if;

  update public.subscriptions set is_active = false where id = v_subscription_id;
end;
$$;
