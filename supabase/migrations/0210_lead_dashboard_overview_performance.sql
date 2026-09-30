-- Leader dashboard phase 1: two read-only SECURITY DEFINER functions.
-- No table is touched. All money/stat math runs here, not in the browser.
-- Both resolve the caller's own provider via providers.user_id = auth.uid().

CREATE OR REPLACE FUNCTION public.lead_dashboard_overview()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_pid uuid;
  v_month timestamptz := date_trunc('month', now());
  v_res jsonb;
BEGIN
  SELECT id INTO v_pid FROM public.providers WHERE user_id = auth.uid();
  IF v_pid IS NULL THEN
    RAISE EXCEPTION 'not a lead trader' USING ERRCODE = 'LT003';
  END IF;

  SELECT jsonb_build_object(
    'aum', COALESCE(sum(allocated_amount) FILTER (WHERE is_active), 0),
    'followers_total', count(*),
    'followers_active', count(*) FILTER (WHERE is_active),
    'followers_new_month', count(*) FILTER (WHERE copy_started_at >= v_month),
    'followers_stopped', count(*) FILTER (WHERE NOT is_active)
  ) INTO v_res
  FROM public.subscriptions WHERE provider_id = v_pid;

  RETURN v_res || (
    SELECT jsonb_build_object(
      'earnings_month', COALESCE(sum(profit_share_amount) FILTER (WHERE created_at >= v_month AND status <> 'waived'), 0),
      'earnings_total', COALESCE(sum(profit_share_amount) FILTER (WHERE status <> 'waived'), 0),
      'earnings_pending', COALESCE(sum(profit_share_amount) FILTER (WHERE status = 'pending'), 0)
    ) FROM public.profit_share_ledger WHERE provider_id = v_pid
  );
END;
$$;
REVOKE ALL ON FUNCTION public.lead_dashboard_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lead_dashboard_overview() TO authenticated;

-- Performance for the caller's own public (non-admin) signals.
-- p_days NULL = all time. ROI is the sum of per-trade signed returns (same
-- convention as the public trader page); max drawdown is compounded.
-- Risk score 1-10 = 60% drawdown (30% dd => 10) + 40% per-trade volatility
-- (5% stddev => 10). Monthly table always covers the last 24 months.
CREATE OR REPLACE FUNCTION public.lead_dashboard_performance(p_days integer DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_pid uuid;
  v_since timestamptz;
  v_roi numeric; v_dd numeric; v_trades integer; v_win numeric; v_dur numeric; v_sd numeric;
  v_risk integer; v_curve jsonb; v_monthly jsonb; v_step integer;
BEGIN
  SELECT id INTO v_pid FROM public.providers WHERE user_id = auth.uid();
  IF v_pid IS NULL THEN
    RAISE EXCEPTION 'not a lead trader' USING ERRCODE = 'LT003';
  END IF;
  IF p_days IS NOT NULL THEN v_since := now() - make_interval(days => p_days); END IF;

  CREATE TEMP TABLE _lt ON COMMIT DROP AS
  SELECT s.id, s.opened_at, s.closed_at,
         greatest(CASE WHEN s.side = 'sell' THEN -(s.exit_price - s.entry_price) / s.entry_price
                       ELSE (s.exit_price - s.entry_price) / s.entry_price END, -0.999999)::double precision AS r
  FROM public.signals s
  WHERE s.provider_id = v_pid AND s.status = 'closed' AND s.created_by_admin = false
    AND s.exit_price IS NOT NULL AND s.entry_price > 0 AND s.closed_at IS NOT NULL
    AND (v_since IS NULL OR s.closed_at >= v_since);

  SELECT count(*), round(100.0 * count(*) FILTER (WHERE r > 0) / NULLIF(count(*), 0), 1),
         round((100 * COALESCE(sum(r), 0))::numeric, 2),
         round((avg(extract(epoch FROM (closed_at - opened_at))) / 3600)::numeric, 1),
         COALESCE(stddev_samp(r), 0)
    INTO v_trades, v_win, v_roi, v_dur, v_sd
  FROM _lt;

  WITH e AS (SELECT id, closed_at, r, sum(ln(1 + r)) OVER (ORDER BY closed_at, id) AS lg FROM _lt),
       p AS (SELECT lg, greatest(0, max(lg) OVER (ORDER BY closed_at, id)) AS pk FROM e)
  SELECT COALESCE(round((100 * max(1 - exp(lg - pk)))::numeric, 2), 0) INTO v_dd FROM p;

  v_risk := greatest(1, least(10, round(0.6 * least(10, v_dd / 3) + 0.4 * least(10, v_sd * 100 * 2))::integer));
  IF v_trades = 0 THEN v_risk := NULL; END IF;

  v_step := greatest(1, ceil(v_trades / 200.0)::integer);
  SELECT COALESCE(jsonb_agg(jsonb_build_object('t', closed_at, 'v', round((cum * 100)::numeric, 2)) ORDER BY closed_at), '[]'::jsonb)
    INTO v_curve
  FROM (
    SELECT closed_at, cum, rn, count(*) OVER () AS n
    FROM (SELECT closed_at, sum(r) OVER (ORDER BY closed_at, id) AS cum,
                 row_number() OVER (ORDER BY closed_at, id) AS rn FROM _lt) x
  ) y WHERE rn % v_step = 0 OR rn = n;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('month', m, 'ret', ret, 'trades', c) ORDER BY m DESC), '[]'::jsonb)
    INTO v_monthly
  FROM (
    SELECT to_char(date_trunc('month', s.closed_at), 'YYYY-MM') AS m, count(*) AS c,
           round((100 * sum(CASE WHEN s.side = 'sell' THEN -(s.exit_price - s.entry_price) / s.entry_price
                                 ELSE (s.exit_price - s.entry_price) / s.entry_price END))::numeric, 2) AS ret
    FROM public.signals s
    WHERE s.provider_id = v_pid AND s.status = 'closed' AND s.created_by_admin = false
      AND s.exit_price IS NOT NULL AND s.entry_price > 0 AND s.closed_at >= date_trunc('month', now()) - interval '23 months'
    GROUP BY 1
  ) mm;

  RETURN jsonb_build_object('roi', v_roi, 'max_drawdown', v_dd, 'win_rate', v_win, 'trades', v_trades,
                            'avg_duration_hours', v_dur, 'risk_score', v_risk, 'curve', v_curve, 'monthly', v_monthly);
END;
$$;
REVOKE ALL ON FUNCTION public.lead_dashboard_performance(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lead_dashboard_performance(integer) TO authenticated;
