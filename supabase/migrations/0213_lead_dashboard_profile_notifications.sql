-- Leader dashboard phase 4: public profile text, avatar, announcement delete,
-- and leader notifications (new copier / copier stopped / account status).
--
-- Existing-table changes (all additive, nothing dropped or retyped):
--   lead_trader_profiles  + strategy_description, risk_disclosure (nullable)
-- A full copy of lead_trader_profiles is taken first (see rollback file).

CREATE TABLE IF NOT EXISTS public._bak_20260930_lead_trader_profiles AS SELECT * FROM public.lead_trader_profiles;
ALTER TABLE public._bak_20260930_lead_trader_profiles ENABLE ROW LEVEL SECURITY; -- no policies: unreadable via the API

ALTER TABLE public.lead_trader_profiles ADD COLUMN IF NOT EXISTS strategy_description text;
ALTER TABLE public.lead_trader_profiles ADD COLUMN IF NOT EXISTS risk_disclosure text;
-- 0209 revoked table-wide SELECT (to hide invite_code); new public columns need an explicit grant.
GRANT SELECT (strategy_description, risk_disclosure) ON public.lead_trader_profiles TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.lead_trader_update_public_profile(p_strategy text, p_risk text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE v_pid uuid;
BEGIN
  SELECT id INTO v_pid FROM public.providers WHERE user_id = auth.uid();
  IF v_pid IS NULL THEN
    RAISE EXCEPTION 'not a lead trader' USING ERRCODE = 'LT003';
  END IF;
  IF length(COALESCE(p_strategy, '')) > 1500 OR length(COALESCE(p_risk, '')) > 1000 THEN
    RAISE EXCEPTION 'text too long' USING ERRCODE = 'LT030';
  END IF;
  INSERT INTO public.lead_trader_profiles (provider_id, strategy_description, risk_disclosure)
  VALUES (v_pid, NULLIF(btrim(p_strategy), ''), NULLIF(btrim(p_risk), ''))
  ON CONFLICT (provider_id) DO UPDATE
    SET strategy_description = EXCLUDED.strategy_description,
        risk_disclosure = EXCLUDED.risk_disclosure,
        updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.lead_trader_update_public_profile(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lead_trader_update_public_profile(text, text) TO authenticated;

-- Avatar: the file itself is uploaded by the server action (service role) into
-- the public leader-avatars bucket under <provider_id>/; this only lets the
-- owner point providers.avatar_url at a file inside their own folder.
CREATE OR REPLACE FUNCTION public.lead_trader_set_avatar(p_url text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE v_pid uuid;
BEGIN
  SELECT id INTO v_pid FROM public.providers WHERE user_id = auth.uid();
  IF v_pid IS NULL THEN
    RAISE EXCEPTION 'not a lead trader' USING ERRCODE = 'LT003';
  END IF;
  IF p_url IS NULL OR position('/leader-avatars/' || v_pid::text || '/' IN p_url) = 0 THEN
    RAISE EXCEPTION 'invalid avatar url' USING ERRCODE = 'LT031';
  END IF;
  UPDATE public.providers SET avatar_url = p_url WHERE id = v_pid;
END;
$$;
REVOKE ALL ON FUNCTION public.lead_trader_set_avatar(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lead_trader_set_avatar(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.lead_trader_delete_announcement(p_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  DELETE FROM public.lead_trader_announcements a
  USING public.providers p
  WHERE a.id = p_id AND p.id = a.provider_id AND p.user_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.lead_trader_delete_announcement(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lead_trader_delete_announcement(uuid) TO authenticated;

-- ---- Leader notifications --------------------------------------------------
-- Only providers with a real owner (providers.user_id) are notified; the
-- platform-generated leaders have none. Copier identity is never included.
-- Every trigger swallows its own errors: a notification problem must never
-- block a follower from starting or stopping a copy.
CREATE OR REPLACE FUNCTION public.notify_leader_subscription_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE v_owner uuid;
BEGIN
  SELECT user_id INTO v_owner FROM public.providers WHERE id = NEW.provider_id;
  IF v_owner IS NULL THEN RETURN NEW; END IF;

  IF (TG_OP = 'INSERT' AND NEW.is_active) OR (TG_OP = 'UPDATE' AND NEW.is_active AND NOT OLD.is_active) THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (v_owner, 'lead_new_copier', 'نسّاخ جديد', NULL, jsonb_build_object('amount', NEW.allocated_amount));
  ELSIF TG_OP = 'UPDATE' AND NOT NEW.is_active AND OLD.is_active THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (v_owner, 'lead_copier_stopped', 'نسّاخ أوقف النسخ', NULL, jsonb_build_object('amount', OLD.allocated_amount));
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_leader_subscription_change ON public.subscriptions;
CREATE TRIGGER trg_notify_leader_subscription_change
  AFTER INSERT OR UPDATE OF is_active ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.notify_leader_subscription_change();

CREATE OR REPLACE FUNCTION public.notify_leader_provider_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND NEW.trading_status IS DISTINCT FROM OLD.trading_status THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (NEW.user_id, 'lead_status_changed', 'تغيّر حالة الحساب', NULL, jsonb_build_object('status', NEW.trading_status));
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_leader_provider_status ON public.providers;
CREATE TRIGGER trg_notify_leader_provider_status
  AFTER UPDATE OF trading_status ON public.providers
  FOR EACH ROW EXECUTE FUNCTION public.notify_leader_provider_status();

CREATE OR REPLACE FUNCTION public.notify_leader_suspension()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_lead_trader AND NEW.is_suspended IS DISTINCT FROM OLD.is_suspended THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (NEW.id, 'lead_status_changed', 'تغيّر حالة الحساب', NULL, jsonb_build_object('status', CASE WHEN NEW.is_suspended THEN 'suspended' ELSE 'active' END));
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_leader_suspension ON public.profiles;
CREATE TRIGGER trg_notify_leader_suspension
  AFTER UPDATE OF is_suspended ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.notify_leader_suspension();
