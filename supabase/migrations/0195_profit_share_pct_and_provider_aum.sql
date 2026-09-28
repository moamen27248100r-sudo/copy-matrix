-- Profit-share display + AUM.
-- 1) providers.profit_share_pct: optional 0-50 (NULL = not set). Display only,
--    nothing is ever deducted based on it. Exposed as the LAST column of
--    provider_cards (CREATE OR REPLACE VIEW can only append columns); live view
--    definition pulled via pg_get_viewdef before editing, all else unchanged.
-- 2) provider_aum(): sum of allocated_amount over ACTIVE subscriptions whose
--    follower is on a REAL account (demo excluded). SECURITY DEFINER so it works
--    despite subscriptions RLS; returns only the aggregate.
ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS profit_share_pct numeric NULL
  CHECK (profit_share_pct IS NULL OR (profit_share_pct >= 0 AND profit_share_pct <= 50));

CREATE OR REPLACE VIEW public.provider_cards AS
WITH vol_pop AS (
         SELECT perf_1.provider_id,
            perf_1.return_volatility
           FROM provider_performance perf_1
          WHERE perf_1.closed_signals >= 5 AND perf_1.return_volatility IS NOT NULL
        ), vol_bounds AS (
         SELECT count(*) AS n,
            percentile_cont(0.33::double precision) WITHIN GROUP (ORDER BY (vol_pop.return_volatility::double precision)) AS p33,
            percentile_cont(0.66::double precision) WITHIN GROUP (ORDER BY (vol_pop.return_volatility::double precision)) AS p66
           FROM vol_pop
        )
 SELECT p.id AS provider_id,
    p.bio,
    COALESCE(pr.display_name, p.display_name) AS display_name,
    COALESCE(pf.followers_count, 0::bigint) + p.base_followers_count AS followers_count,
    COALESCE(perf.open_signals, 0::bigint) AS open_signals,
    COALESCE(perf.closed_signals, 0::bigint) AS closed_signals,
    perf.win_rate_pct,
    perf.avg_return_pct,
    p.created_at AS joined_at,
    p.total_profit,
    p.total_withdrawals,
    p.min_copy_amount,
    COALESCE(perf.return_volatility, 2::numeric) AS return_volatility,
        CASE
            WHEN COALESCE(perf.closed_signals, 0::bigint) < 5 THEN 'متوسطة'::text
            WHEN vb.n < 30 THEN
            CASE
                WHEN COALESCE(perf.return_volatility, 2::numeric) < 3::numeric THEN 'منخفضة'::text
                WHEN COALESCE(perf.return_volatility, 2::numeric) < 10::numeric THEN 'متوسطة'::text
                ELSE 'مرتفعة'::text
            END
            WHEN perf.return_volatility::double precision < vb.p33 THEN 'منخفضة'::text
            WHEN perf.return_volatility::double precision < vb.p66 THEN 'متوسطة'::text
            ELSE 'مرتفعة'::text
        END AS risk_level,
    round(GREATEST(0::numeric, LEAST(100::numeric, 45::numeric + LEAST(1::numeric, COALESCE(perf.closed_signals, 0::bigint)::numeric / 25.0) * (COALESCE(perf.win_rate_pct, 50::numeric) * 0.6 + GREATEST(LEAST(COALESCE(perf.avg_return_pct, 0::numeric), 5::numeric), '-5'::integer::numeric) * 6::numeric + (8::numeric - LEAST(COALESCE(perf.return_volatility, 2::numeric), 40::numeric)) * 3::numeric - 45::numeric)))) AS rating_score,
        CASE
            WHEN round(GREATEST(0::numeric, LEAST(100::numeric, 45::numeric + LEAST(1::numeric, COALESCE(perf.closed_signals, 0::bigint)::numeric / 25.0) * (COALESCE(perf.win_rate_pct, 50::numeric) * 0.6 + GREATEST(LEAST(COALESCE(perf.avg_return_pct, 0::numeric), 5::numeric), '-5'::integer::numeric) * 6::numeric + (8::numeric - LEAST(COALESCE(perf.return_volatility, 2::numeric), 40::numeric)) * 3::numeric - 45::numeric)))) >= 75::numeric THEN 'نخبة'::text
            WHEN round(GREATEST(0::numeric, LEAST(100::numeric, 45::numeric + LEAST(1::numeric, COALESCE(perf.closed_signals, 0::bigint)::numeric / 25.0) * (COALESCE(perf.win_rate_pct, 50::numeric) * 0.6 + GREATEST(LEAST(COALESCE(perf.avg_return_pct, 0::numeric), 5::numeric), '-5'::integer::numeric) * 6::numeric + (8::numeric - LEAST(COALESCE(perf.return_volatility, 2::numeric), 40::numeric)) * 3::numeric - 45::numeric)))) >= 55::numeric THEN 'محترف'::text
            WHEN round(GREATEST(0::numeric, LEAST(100::numeric, 45::numeric + LEAST(1::numeric, COALESCE(perf.closed_signals, 0::bigint)::numeric / 25.0) * (COALESCE(perf.win_rate_pct, 50::numeric) * 0.6 + GREATEST(LEAST(COALESCE(perf.avg_return_pct, 0::numeric), 5::numeric), '-5'::integer::numeric) * 6::numeric + (8::numeric - LEAST(COALESCE(perf.return_volatility, 2::numeric), 40::numeric)) * 3::numeric - 45::numeric)))) >= 35::numeric THEN 'متوسط'::text
            ELSE 'مبتدئ'::text
        END AS tier,
    perf.avg_daily_return_pct,
    p.country,
    p.account_capital,
    p.trading_status,
    p.margin_called_at,
    p.avatar_url,
    p.is_archived,
    p.symbol_bias,
    p.symbol_bias[1] AS primary_symbol,
    p.profit_share_pct
   FROM providers p
     LEFT JOIN profiles pr ON pr.id = p.user_id
     LEFT JOIN provider_performance perf ON perf.provider_id = p.id
     LEFT JOIN provider_followers pf ON pf.provider_id = p.id
     CROSS JOIN vol_bounds vb;

CREATE OR REPLACE FUNCTION public.provider_aum(p_provider_id uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  select coalesce(sum(s.allocated_amount), 0)
  from public.subscriptions s
  join public.profiles pr on pr.id = s.follower_id
  where s.provider_id = p_provider_id
    and s.is_active
    and pr.account_type = 'real';
$$;
GRANT EXECUTE ON FUNCTION public.provider_aum(uuid) TO anon, authenticated;
