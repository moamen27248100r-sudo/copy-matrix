-- 0258: leader privacy
--
-- A leader's current capital, total withdrawals, total deposits, dollar profit and exact amount of
-- copied money (AUM) are no longer readable by clients at all:
--   * the public view provider_cards drops account_capital, total_withdrawals, total_deposits,
--     total_profit and pnl_7d..pnl_all, and shows aum_band (a coarse band 0..6) instead of aum;
--   * the same three columns are revoked from clients on the providers table.
-- Everything that remains is a ratio or a count: return %, risk, drawdown, win rate, copiers...
-- The service role (admin pages, the engine) still reads the real columns.
-- Rollback: supabase/rollback/0258_leader_privacy.sql

begin;

drop view public.provider_cards;
create view public.provider_cards as
SELECT p.id AS provider_id,
    p.bio,
    COALESCE(pr.display_name, p.display_name) AS display_name,
    COALESCE(st.followers, 0) AS followers_count,
    ( SELECT count(*) AS count
           FROM signals s
          WHERE s.provider_id = p.id AND s.status = 'open'::text AND NOT s.hidden AND NOT s.created_by_admin) AS open_signals,
    COALESCE(st.trades_all, 0) AS closed_signals,
    st.win_rate_all AS win_rate_pct,
    st.avg_trade_return AS avg_return_pct,
    p.created_at AS joined_at,
    p.min_copy_amount,
    COALESCE(st.vol_daily_pct, 0::numeric) AS return_volatility,
    st.risk_level,
    st.rating_score,
    st.tier,
    st.avg_daily_return_pct,
    p.country,
    p.trading_status,
    p.margin_called_at,
    p.avatar_url,
    p.is_archived,
    p.symbol_bias,
    st.primary_symbol,
    p.profit_share_pct,
    st.roi_7d,
    st.roi_30d,
    st.roi_90d,
    st.roi_180d,
    st.roi_all,
    st.trades_7d,
    st.trades_30d,
    st.trades_90d,
    st.trades_180d,
    st.trades_all,
    st.win_rate_7d,
    st.win_rate_30d,
    st.win_rate_90d,
    st.win_rate_180d,
    st.win_rate_all,
    st.mdd_7d,
    st.mdd_30d,
    st.mdd_90d,
    st.mdd_180d,
    st.mdd_all,
    st.sharpe_7d,
    st.sharpe_30d,
    st.sharpe_90d,
    st.sharpe_180d,
    st.sharpe_all,
    st.avg_win_pct,
    st.avg_loss_pct,
    st.profit_factor,
    st.positive_months,
    st.months_counted,
    st.active_days,
    st.track_days,
    st.first_day,
    -- Approximate size of the copied money, never the exact amount: 0 under $10,000, 1 from $10,000,
    -- 2 from $50,000, 3 from $100,000, 4 from $250,000, 5 from $500,000, 6 from $1,000,000.
    (CASE WHEN st.aum >= 1000000 THEN 6 WHEN st.aum >= 500000 THEN 5 WHEN st.aum >= 250000 THEN 4
          WHEN st.aum >= 100000 THEN 3 WHEN st.aum >= 50000 THEN 2 WHEN st.aum >= 10000 THEN 1 ELSE 0 END)::smallint AS aum_band,
    st.avg_hold_hours,
    st.trades_per_week,
    st.limit_pct,
    st.asset_mix,
    st.primary_asset,
    st.style
   FROM providers p
     LEFT JOIN profiles pr ON pr.id = p.user_id
     LEFT JOIN provider_stats st ON st.provider_id = p.id
  WHERE NOT p.is_simulated OR ( SELECT viewer_sees_simulated() AS viewer_sees_simulated);
grant select on public.provider_cards to anon, authenticated, service_role;

revoke select (total_profit, total_withdrawals, account_capital) on public.providers from authenticated;

commit;
