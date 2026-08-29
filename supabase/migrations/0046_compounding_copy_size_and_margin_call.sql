-- ============================================================
-- Copy Matrix — copied position size was a fixed number frozen at
-- the moment a customer started copying a leader (their original
-- allocated_amount), used for every single trade forever after. A
-- real copy-trading account compounds: a winning trade grows the
-- money actually at risk on the next trade, a losing streak shrinks
-- it, and if the account is wiped out to zero it simply cannot take
-- any more copied trades until the customer deposits again (a real
-- margin call) — even while still "following" the same leader.
--
-- This migration makes each newly-mirrored position size itself off
-- the follower's live wallet balance at that exact moment instead of
-- the frozen original allocation, and skips mirroring entirely for
-- any follower whose balance is already at or below zero.
-- ============================================================

create or replace function public.mirror_signal_to_followers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.simulated_positions (signal_id, subscription_id, follower_id, entry_price, size)
  select new.id, sub.id, sub.follower_id, new.entry_price, p.balance
  from public.subscriptions sub
  join public.profiles p on p.id = sub.follower_id
  where sub.provider_id = new.provider_id
    and sub.is_active = true
    and p.balance > 0;
  return new;
end;
$$;
