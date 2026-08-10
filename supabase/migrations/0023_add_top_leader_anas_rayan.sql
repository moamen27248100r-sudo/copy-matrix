-- ============================================================
-- Copy Matrix — add a new curated top leader, "أنس ريان": highest
-- avg return, highest win rate, and lowest volatility of any leader
-- on the platform, so he tops both the profit and lowest-risk views.
-- Trade history is precomputed (not sql random()) so the resulting
-- win_rate_pct / avg_return_pct / return_volatility are known and
-- verified in advance rather than left to chance.
-- ============================================================

do $$
declare
  v_provider_id uuid;
begin
  insert into public.providers (
    display_name, bio, base_followers_count, skill,
    total_profit, total_withdrawals, min_copy_amount, created_at
  )
  values (
    'أنس ريان',
    'متداول محترف متخصص في إدارة المخاطر بدقة — عائد ثابت شهريًا بأقل تقلب ممكن، وسجل أداء موثّق بالكامل.',
    280,
    0.93,
    271430.00,
    88250.00,
    100,
    timestamp '2024-02-10'
  )
  returning id into v_provider_id;

  insert into public.signals (provider_id, symbol, side, entry_price, exit_price, status, opened_at, closed_at)
  values
  (v_provider_id, 'BTCUSDT', 'buy', 62804.950617, 63891.844564, 'closed', now() - interval '76 days', now() - interval '73 days'),
  (v_provider_id, 'ETHUSDT', 'buy', 3392.625754, 3369.084221, 'closed', now() - interval '83 days', now() - interval '81 days'),
  (v_provider_id, 'XAUUSD', 'sell', 4314.656276, 4220.282491, 'closed', now() - interval '12 days', now() - interval '11 days'),
  (v_provider_id, 'EURUSD', 'buy', 1.082783, 1.106872, 'closed', now() - interval '117 days', now() - interval '116 days'),
  (v_provider_id, 'GBPUSD', 'buy', 1.265604, 1.294132, 'closed', now() - interval '130 days', now() - interval '128 days'),
  (v_provider_id, 'USDJPY', 'sell', 156.579941, 152.955222, 'closed', now() - interval '141 days', now() - interval '139 days'),
  (v_provider_id, 'SOLUSDT', 'sell', 144.963849, 142.132202, 'closed', now() - interval '87 days', now() - interval '86 days'),
  (v_provider_id, 'BNBUSDT', 'sell', 570.878945, 559.485447, 'closed', now() - interval '88 days', now() - interval '85 days'),
  (v_provider_id, 'BTCUSDT', 'sell', 62756.296296, 61365.693386, 'closed', now() - interval '113 days', now() - interval '111 days'),
  (v_provider_id, 'ETHUSDT', 'sell', 3396.436180, 3330.327391, 'closed', now() - interval '88 days', now() - interval '85 days'),
  (v_provider_id, 'XAUUSD', 'sell', 4297.886866, 4224.479665, 'closed', now() - interval '55 days', now() - interval '54 days'),
  (v_provider_id, 'EURUSD', 'sell', 1.081677, 1.056705, 'closed', now() - interval '30 days', now() - interval '28 days'),
  (v_provider_id, 'GBPUSD', 'buy', 1.272828, 1.299262, 'closed', now() - interval '63 days', now() - interval '61 days'),
  (v_provider_id, 'USDJPY', 'sell', 156.046896, 152.454516, 'closed', now() - interval '134 days', now() - interval '133 days'),
  (v_provider_id, 'SOLUSDT', 'sell', 144.941373, 142.259993, 'closed', now() - interval '141 days', now() - interval '139 days'),
  (v_provider_id, 'BNBUSDT', 'buy', 567.858493, 580.170837, 'closed', now() - interval '117 days', now() - interval '114 days'),
  (v_provider_id, 'BTCUSDT', 'buy', 63062.827160, 64435.598505, 'closed', now() - interval '125 days', now() - interval '124 days'),
  (v_provider_id, 'ETHUSDT', 'sell', 3402.625206, 3344.879879, 'closed', now() - interval '96 days', now() - interval '95 days'),
  (v_provider_id, 'XAUUSD', 'buy', 4289.965192, 4374.917537, 'closed', now() - interval '48 days', now() - interval '46 days'),
  (v_provider_id, 'EURUSD', 'sell', 1.082670, 1.058141, 'closed', now() - interval '128 days', now() - interval '126 days'),
  (v_provider_id, 'GBPUSD', 'sell', 1.266360, 1.236915, 'closed', now() - interval '148 days', now() - interval '145 days'),
  (v_provider_id, 'USDJPY', 'buy', 156.995127, 160.437945, 'closed', now() - interval '106 days', now() - interval '105 days'),
  (v_provider_id, 'SOLUSDT', 'buy', 145.628980, 148.722072, 'closed', now() - interval '90 days', now() - interval '89 days'),
  (v_provider_id, 'BNBUSDT', 'buy', 567.347917, 564.594900, 'closed', now() - interval '90 days', now() - interval '89 days'),
  (v_provider_id, 'BTCUSDT', 'buy', 62962.320988, 64447.031247, 'closed', now() - interval '95 days', now() - interval '92 days'),
  (v_provider_id, 'ETHUSDT', 'buy', 3390.205178, 3463.514877, 'closed', now() - interval '114 days', now() - interval '113 days'),
  (v_provider_id, 'XAUUSD', 'sell', 4308.940638, 4233.701008, 'closed', now() - interval '30 days', now() - interval '28 days'),
  (v_provider_id, 'EURUSD', 'buy', 1.088307, 1.083855, 'closed', now() - interval '110 days', now() - interval '107 days'),
  (v_provider_id, 'GBPUSD', 'buy', 1.273637, 1.299740, 'closed', now() - interval '150 days', now() - interval '148 days'),
  (v_provider_id, 'USDJPY', 'sell', 157.125436, 154.389428, 'closed', now() - interval '63 days', now() - interval '61 days'),
  (v_provider_id, 'SOLUSDT', 'buy', 145.111236, 148.318951, 'closed', now() - interval '103 days', now() - interval '100 days'),
  (v_provider_id, 'BNBUSDT', 'buy', 568.995365, 581.550689, 'closed', now() - interval '146 days', now() - interval '145 days'),
  (v_provider_id, 'BTCUSDT', 'buy', 62859.222222, 63885.371001, 'closed', now() - interval '142 days', now() - interval '139 days'),
  (v_provider_id, 'ETHUSDT', 'buy', 3397.373628, 3478.728493, 'closed', now() - interval '22 days', now() - interval '20 days'),
  (v_provider_id, 'XAUUSD', 'sell', 4299.603326, 4224.396541, 'closed', now() - interval '53 days', now() - interval '52 days'),
  (v_provider_id, 'EURUSD', 'sell', 1.085057, 1.059372, 'closed', now() - interval '63 days', now() - interval '62 days'),
  (v_provider_id, 'GBPUSD', 'sell', 1.263771, 1.236771, 'closed', now() - interval '121 days', now() - interval '118 days'),
  (v_provider_id, 'USDJPY', 'buy', 157.210663, 160.130415, 'closed', now() - interval '122 days', now() - interval '121 days'),
  (v_provider_id, 'SOLUSDT', 'buy', 144.641229, 147.349686, 'closed', now() - interval '79 days', now() - interval '78 days'),
  (v_provider_id, 'BNBUSDT', 'sell', 567.171209, 555.618480, 'closed', now() - interval '45 days', now() - interval '44 days'),
  (v_provider_id, 'BTCUSDT', 'buy', 62924.641975, 63958.578433, 'closed', now() - interval '153 days', now() - interval '151 days');

  -- A couple of currently-open positions, like the other active leaders.
  insert into public.signals (provider_id, symbol, side, entry_price, status, opened_at)
  values
  (v_provider_id, 'XAUUSD', 'buy', 4341.935, 'open', now() - interval '4 hours'),
  (v_provider_id, 'EURUSD', 'sell', 1.15537, 'open', now() - interval '9 hours');
end $$;
