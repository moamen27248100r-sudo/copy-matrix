-- Lead Trader system, Phase 1: role flag + application flow.
-- Purely additive: one new nullable-with-default column on profiles, one new
-- table, RLS policies scoped to that new table only. Nothing existing is
-- altered. Mirrors the kyc_submissions pending/approved/rejected pattern
-- (0002_kyc_and_followers.sql) and its status-change notification trigger
-- (0010_notifications.sql notify_kyc_status_change()).

-- Role flag. Locked down like is_admin/is_suspended (0180): NOT added to the
-- authenticated column-UPDATE grant, so it can only ever be set by an admin
-- action through the service-role client (createAdminClient()).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_lead_trader boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.lead_trader_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  display_name text NOT NULL,
  bio text,
  markets text[] NOT NULL DEFAULT '{}',
  trading_style text,
  -- Private contact method for the admin reviewer only; never exposed publicly.
  contact_info text,
  requested_min_investment numeric,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason text,
  -- Set by the approval action once the provider row is created (Phase 1 approve flow).
  provider_id uuid REFERENCES public.providers(id),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewer_admin_id uuid REFERENCES public.profiles(id)
);

-- One open application at a time per user (still allows re-applying after a rejection).
CREATE UNIQUE INDEX IF NOT EXISTS lead_trader_applications_one_pending_per_user
  ON public.lead_trader_applications (user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS lead_trader_applications_user_id_idx ON public.lead_trader_applications (user_id);

ALTER TABLE public.lead_trader_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY lead_trader_applications_select_own ON public.lead_trader_applications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY lead_trader_applications_insert_own ON public.lead_trader_applications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY lead_trader_applications_select_admin ON public.lead_trader_applications
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin));

CREATE POLICY lead_trader_applications_update_admin ON public.lead_trader_applications
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin));

GRANT SELECT, INSERT, UPDATE ON public.lead_trader_applications TO authenticated;

-- Status-change notification, same shape as notify_kyc_status_change() (0010).
CREATE OR REPLACE FUNCTION public.notify_lead_trader_application_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved', 'rejected') THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      NEW.user_id,
      CASE WHEN NEW.status = 'approved' THEN 'lead_trader_application_approved' ELSE 'lead_trader_application_rejected' END,
      CASE WHEN NEW.status = 'approved' THEN 'تم قبول طلبك كمتداول قائد' ELSE 'تم رفض طلب التقديم' END,
      CASE WHEN NEW.status = 'approved' THEN 'يمكنك الآن إدارة صفقاتك ومتابعيك من مركز المتداول القائد.' ELSE COALESCE(NEW.rejection_reason, '') END,
      jsonb_build_object('status', NEW.status, 'rejectionReason', NEW.rejection_reason)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_lead_trader_application_status_change
  AFTER UPDATE ON public.lead_trader_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_lead_trader_application_status_change();
