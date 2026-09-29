-- Follow-up to 0201: lead_trader_announcements had no INSERT policy yet (RLS
-- defaults to deny with none defined, so the table was write-locked for
-- everyone until now), and `notifications` only allows admin inserts
-- (notifications_insert_admin) -- a lead trader posting an announcement needs
-- to fan it out to their own active followers' notifications, which a plain
-- RLS-respecting insert can't do. One new RPC does both atomically, scoped
-- strictly to the caller's own provider row and their own active followers.

CREATE POLICY lead_trader_announcements_insert_own ON public.lead_trader_announcements
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.providers pr WHERE pr.id = lead_trader_announcements.provider_id AND pr.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.lead_trader_post_announcement(p_body text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_provider_id uuid;
  v_display_name text;
  v_announcement_id uuid;
BEGIN
  IF p_body IS NULL OR btrim(p_body) = '' THEN
    RAISE EXCEPTION 'empty announcement' USING ERRCODE = 'LT009';
  END IF;

  SELECT id, display_name INTO v_provider_id, v_display_name FROM public.providers WHERE user_id = auth.uid();
  IF v_provider_id IS NULL THEN
    RAISE EXCEPTION 'not a lead trader' USING ERRCODE = 'LT003';
  END IF;

  INSERT INTO public.lead_trader_announcements (provider_id, body) VALUES (v_provider_id, p_body) RETURNING id INTO v_announcement_id;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  SELECT s.follower_id, 'lead_trader_announcement', COALESCE(v_display_name, ''), p_body, jsonb_build_object('providerId', v_provider_id)
  FROM public.subscriptions s
  WHERE s.provider_id = v_provider_id AND s.is_active;

  RETURN v_announcement_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.lead_trader_post_announcement(text) TO authenticated;
