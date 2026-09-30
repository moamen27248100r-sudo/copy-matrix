-- Leader dashboard phase 2: paginated, filterable copier list.
-- Read-only SECURITY DEFINER function. Returns a masked alias only (first two
-- letters of the display name + ***, or C-xxxx) -- never email, phone, country
-- or balance. Search matches the masked alias, so it cannot be used to probe
-- real names. Everything is scoped to the caller's own provider.
CREATE OR REPLACE FUNCTION public.lead_dashboard_copiers(
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
) RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_pid uuid;
  v_res jsonb;
BEGIN
  SELECT id INTO v_pid FROM public.providers WHERE user_id = auth.uid();
  IF v_pid IS NULL THEN
    RAISE EXCEPTION 'not a lead trader' USING ERRCODE = 'LT003';
  END IF;

  WITH base AS (
    SELECT s.id, s.allocated_amount, s.is_active, s.copy_started_at,
           COALESCE(NULLIF(left(btrim(pr.display_name), 2), '') || '***', 'C-' || left(s.follower_id::text, 4)) AS alias,
           COALESCE((SELECT sum(sp.pnl) FROM public.simulated_positions sp WHERE sp.subscription_id = s.id AND sp.status = 'closed'), 0) AS pnl,
           (SELECT count(*) FROM public.simulated_positions sp WHERE sp.subscription_id = s.id AND sp.status = 'open') AS open_positions
    FROM public.subscriptions s
    LEFT JOIN public.profiles pr ON pr.id = s.follower_id
    WHERE s.provider_id = v_pid
      AND (p_status IS NULL OR p_status = '' OR (p_status = 'active' AND s.is_active) OR (p_status = 'stopped' AND NOT s.is_active))
  ), filtered AS (
    SELECT * FROM base WHERE p_search IS NULL OR btrim(p_search) = '' OR alias ILIKE '%' || replace(replace(btrim(p_search), '%', ''), '_', '') || '%'
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM filtered),
    'rows', COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM (
        SELECT id, alias, allocated_amount, round(pnl::numeric, 2) AS pnl, copy_started_at AS joined_at, is_active, open_positions
        FROM filtered ORDER BY copy_started_at DESC NULLS LAST
        LIMIT greatest(1, least(p_limit, 100)) OFFSET greatest(0, p_offset)) r), '[]'::jsonb)
  ) INTO v_res;
  RETURN v_res;
END;
$$;
REVOKE ALL ON FUNCTION public.lead_dashboard_copiers(text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lead_dashboard_copiers(text, text, integer, integer) TO authenticated;
