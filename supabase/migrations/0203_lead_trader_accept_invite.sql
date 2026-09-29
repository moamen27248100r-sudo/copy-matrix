-- Accepting a follower invite: follower_invites has no UPDATE policy (only
-- SELECT), so marking a code used needs its own narrow RPC rather than a
-- direct client update.
CREATE OR REPLACE FUNCTION public.accept_follower_invite(p_code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_provider_id uuid;
BEGIN
  UPDATE public.follower_invites
  SET used_by = auth.uid(), used_at = now()
  WHERE code = p_code
    AND NOT revoked
    AND used_by IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  RETURNING provider_id INTO v_provider_id;

  IF v_provider_id IS NULL THEN
    -- Already-used-by-me codes (e.g. a refreshed page) still resolve, so the
    -- redirect keeps working; anything else (used by someone else, revoked,
    -- expired, unknown) returns null and the caller shows an error.
    SELECT provider_id INTO v_provider_id FROM public.follower_invites WHERE code = p_code AND used_by = auth.uid();
  END IF;

  RETURN v_provider_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.accept_follower_invite(text) TO authenticated;
