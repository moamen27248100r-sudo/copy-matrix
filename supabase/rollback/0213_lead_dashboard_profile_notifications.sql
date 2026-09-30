-- Rolls back 0213. The two added columns are new (no prior data), so they are
-- simply dropped. _bak_20260930_lead_trader_profiles holds the pre-change copy
-- of the table; restore from it if ever needed, then drop it.
DROP TRIGGER IF EXISTS trg_notify_leader_subscription_change ON public.subscriptions;
DROP TRIGGER IF EXISTS trg_notify_leader_provider_status ON public.providers;
DROP TRIGGER IF EXISTS trg_notify_leader_suspension ON public.profiles;
DROP FUNCTION IF EXISTS public.notify_leader_subscription_change();
DROP FUNCTION IF EXISTS public.notify_leader_provider_status();
DROP FUNCTION IF EXISTS public.notify_leader_suspension();
DROP FUNCTION IF EXISTS public.lead_trader_delete_announcement(uuid);
DROP FUNCTION IF EXISTS public.lead_trader_set_avatar(text);
DROP FUNCTION IF EXISTS public.lead_trader_update_public_profile(text, text);
ALTER TABLE public.lead_trader_profiles DROP COLUMN IF EXISTS strategy_description;
ALTER TABLE public.lead_trader_profiles DROP COLUMN IF EXISTS risk_disclosure;
-- DROP TABLE public._bak_20260930_lead_trader_profiles;  -- only once you are sure
