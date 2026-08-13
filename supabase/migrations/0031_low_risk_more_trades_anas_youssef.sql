-- ============================================================
-- Copy Matrix — Anas Rayan and Youssef Ali: more trades (~100 each)
-- spread across the last 6 months, tight low-volatility moves so
-- risk_level reads "منخفضة" (the platform-wide asymmetric win/loss
-- widening from 0030 pushed their volatility into "مرتفعة"), and
-- minimum copy amount raised to $500 for both. Trade histories are
-- precomputed (not sql random()) so win_rate_pct / avg_return_pct /
-- return_volatility are known exactly in advance.
--
-- run_market_simulation() is also updated to special-case these two
-- providers with the same tight range going forward, so future
-- automated cron ticks don't drift their risk back up to "مرتفعة"
-- the way their default-sort ranking drifted before (see 0028).
-- ============================================================

do $$
declare
  v_anas_id uuid;
  v_youssef_id uuid;
begin
  select id into v_anas_id from public.providers where display_name = 'أنس ريان';
  select id into v_youssef_id from public.providers where display_name = 'يوسف علي';

  update public.providers set skill = 0.82, min_copy_amount = 500 where id = v_anas_id;
  update public.providers set skill = 0.84, min_copy_amount = 500 where id = v_youssef_id;

  delete from public.signals where provider_id = v_anas_id;
  delete from public.signals where provider_id = v_youssef_id;

  insert into public.signals (provider_id, symbol, side, entry_price, exit_price, status, opened_at, closed_at)
  values
  (v_anas_id, 'BTCUSDT', 'sell', 62841.6746, 62188.3018, 'closed', now() - interval '143 days', now() - interval '142 days'),
  (v_anas_id, 'GBPUSD', 'sell', 1.279885, 1.261009, 'closed', now() - interval '177 days', now() - interval '175 days'),
  (v_anas_id, 'USDJPY', 'buy', 156.963738, 159.166316, 'closed', now() - interval '174 days', now() - interval '172 days'),
  (v_anas_id, 'ETHUSDT', 'sell', 3393.0452, 3434.5346, 'closed', now() - interval '130 days', now() - interval '129 days'),
  (v_anas_id, 'BTCUSDT', 'buy', 62975.4296, 64002.4393, 'closed', now() - interval '19 days', now() - interval '18 days'),
  (v_anas_id, 'XRPUSDT', 'buy', 0.622194, 0.630818, 'closed', now() - interval '5 days', now() - interval '3 days'),
  (v_anas_id, 'XRPUSDT', 'buy', 0.616915, 0.624365, 'closed', now() - interval '158 days', now() - interval '157 days'),
  (v_anas_id, 'EURUSD', 'sell', 1.094904, 1.072577, 'closed', now() - interval '114 days', now() - interval '113 days'),
  (v_anas_id, 'USDJPY', 'buy', 155.942606, 154.242153, 'closed', now() - interval '28 days', now() - interval '27 days'),
  (v_anas_id, 'ETHUSDT', 'sell', 3420.7196, 3438.5982, 'closed', now() - interval '82 days', now() - interval '81 days'),
  (v_anas_id, 'GBPUSD', 'sell', 1.264322, 1.253951, 'closed', now() - interval '1 days', now() - interval '1 days'),
  (v_anas_id, 'XRPUSDT', 'sell', 0.616064, 0.605333, 'closed', now() - interval '151 days', now() - interval '149 days'),
  (v_anas_id, 'USDJPY', 'sell', 155.482012, 153.129896, 'closed', now() - interval '151 days', now() - interval '149 days'),
  (v_anas_id, 'ETHUSDT', 'buy', 3431.9192, 3475.5748, 'closed', now() - interval '15 days', now() - interval '14 days'),
  (v_anas_id, 'USDJPY', 'sell', 156.067799, 157.322642, 'closed', now() - interval '2 days', now() - interval '1 days'),
  (v_anas_id, 'SOLUSDT', 'buy', 144.571858, 146.858691, 'closed', now() - interval '121 days', now() - interval '120 days'),
  (v_anas_id, 'BNBUSDT', 'buy', 565.672908, 559.284096, 'closed', now() - interval '13 days', now() - interval '12 days'),
  (v_anas_id, 'BTCUSDT', 'buy', 62387.7468, 63309.9089, 'closed', now() - interval '47 days', now() - interval '46 days'),
  (v_anas_id, 'EURUSD', 'buy', 1.08836, 1.097428, 'closed', now() - interval '24 days', now() - interval '22 days'),
  (v_anas_id, 'ETHUSDT', 'sell', 3383.8767, 3320.4017, 'closed', now() - interval '68 days', now() - interval '66 days'),
  (v_anas_id, 'EURUSD', 'buy', 1.092526, 1.116301, 'closed', now() - interval '158 days', now() - interval '157 days'),
  (v_anas_id, 'XAUUSD', 'sell', 4296.0826, 4241.9075, 'closed', now() - interval '72 days', now() - interval '70 days'),
  (v_anas_id, 'USDJPY', 'buy', 157.933231, 161.39318, 'closed', now() - interval '142 days', now() - interval '141 days'),
  (v_anas_id, 'GBPUSD', 'sell', 1.261834, 1.243337, 'closed', now() - interval '52 days', now() - interval '51 days'),
  (v_anas_id, 'EURUSD', 'buy', 1.075994, 1.089562, 'closed', now() - interval '89 days', now() - interval '88 days'),
  (v_anas_id, 'EURUSD', 'buy', 1.074318, 1.091319, 'closed', now() - interval '78 days', now() - interval '76 days'),
  (v_anas_id, 'BNBUSDT', 'sell', 566.508012, 557.05237, 'closed', now() - interval '124 days', now() - interval '123 days'),
  (v_anas_id, 'ETHUSDT', 'buy', 3432.6251, 3389.9331, 'closed', now() - interval '69 days', now() - interval '68 days'),
  (v_anas_id, 'ETHUSDT', 'sell', 3370.2942, 3413.1031, 'closed', now() - interval '45 days', now() - interval '44 days'),
  (v_anas_id, 'BNBUSDT', 'sell', 571.614333, 562.901141, 'closed', now() - interval '116 days', now() - interval '115 days'),
  (v_anas_id, 'XAUUSD', 'sell', 4337.1907, 4377.6798, 'closed', now() - interval '84 days', now() - interval '83 days'),
  (v_anas_id, 'BNBUSDT', 'sell', 570.389869, 565.224144, 'closed', now() - interval '77 days', now() - interval '76 days'),
  (v_anas_id, 'ETHUSDT', 'buy', 3375.7473, 3336.0801, 'closed', now() - interval '117 days', now() - interval '116 days'),
  (v_anas_id, 'BTCUSDT', 'sell', 63192.9334, 61845.056, 'closed', now() - interval '77 days', now() - interval '75 days'),
  (v_anas_id, 'USDJPY', 'sell', 156.428702, 157.493079, 'closed', now() - interval '54 days', now() - interval '52 days'),
  (v_anas_id, 'ETHUSDT', 'buy', 3371.4957, 3348.4596, 'closed', now() - interval '30 days', now() - interval '28 days'),
  (v_anas_id, 'USDJPY', 'sell', 157.802441, 154.852867, 'closed', now() - interval '2 days', now() - interval '1 days'),
  (v_anas_id, 'ETHUSDT', 'sell', 3427.1547, 3369.302, 'closed', now() - interval '46 days', now() - interval '44 days'),
  (v_anas_id, 'ETHUSDT', 'sell', 3397.732, 3356.3646, 'closed', now() - interval '32 days', now() - interval '31 days'),
  (v_anas_id, 'ETHUSDT', 'sell', 3395.1912, 3362.7558, 'closed', now() - interval '114 days', now() - interval '113 days'),
  (v_anas_id, 'ETHUSDT', 'buy', 3433.5025, 3482.9127, 'closed', now() - interval '3 days', now() - interval '2 days'),
  (v_anas_id, 'SOLUSDT', 'buy', 145.718838, 148.196883, 'closed', now() - interval '34 days', now() - interval '33 days'),
  (v_anas_id, 'USDJPY', 'sell', 154.995703, 152.660246, 'closed', now() - interval '14 days', now() - interval '13 days'),
  (v_anas_id, 'BTCUSDT', 'sell', 62377.4337, 61142.4997, 'closed', now() - interval '161 days', now() - interval '160 days'),
  (v_anas_id, 'BNBUSDT', 'sell', 575.060445, 565.599748, 'closed', now() - interval '138 days', now() - interval '137 days'),
  (v_anas_id, 'XAUUSD', 'buy', 4324.2602, 4363.0357, 'closed', now() - interval '56 days', now() - interval '55 days'),
  (v_anas_id, 'BTCUSDT', 'buy', 62551.1059, 63124.8848, 'closed', now() - interval '176 days', now() - interval '174 days'),
  (v_anas_id, 'SOLUSDT', 'buy', 143.798486, 146.23166, 'closed', now() - interval '18 days', now() - interval '16 days'),
  (v_anas_id, 'US30', 'sell', 39379.0298, 38846.034, 'closed', now() - interval '157 days', now() - interval '155 days'),
  (v_anas_id, 'XRPUSDT', 'buy', 0.625146, 0.631756, 'closed', now() - interval '90 days', now() - interval '89 days'),
  (v_anas_id, 'USDJPY', 'sell', 155.239488, 153.3151, 'closed', now() - interval '11 days', now() - interval '10 days'),
  (v_anas_id, 'GBPUSD', 'sell', 1.270125, 1.253445, 'closed', now() - interval '58 days', now() - interval '56 days'),
  (v_anas_id, 'USDJPY', 'buy', 157.135327, 154.935671, 'closed', now() - interval '103 days', now() - interval '101 days'),
  (v_anas_id, 'SOLUSDT', 'buy', 145.237206, 146.621545, 'closed', now() - interval '49 days', now() - interval '47 days'),
  (v_anas_id, 'EURUSD', 'buy', 1.088447, 1.079874, 'closed', now() - interval '43 days', now() - interval '42 days'),
  (v_anas_id, 'XAUUSD', 'buy', 4259.4192, 4347.8989, 'closed', now() - interval '98 days', now() - interval '97 days'),
  (v_anas_id, 'BTCUSDT', 'sell', 62793.8495, 61748.8841, 'closed', now() - interval '63 days', now() - interval '61 days'),
  (v_anas_id, 'BNBUSDT', 'buy', 566.781746, 576.921561, 'closed', now() - interval '132 days', now() - interval '131 days'),
  (v_anas_id, 'XRPUSDT', 'sell', 0.624264, 0.611758, 'closed', now() - interval '60 days', now() - interval '58 days'),
  (v_anas_id, 'USDJPY', 'sell', 157.968894, 155.118812, 'closed', now() - interval '61 days', now() - interval '59 days'),
  (v_anas_id, 'XAUUSD', 'sell', 4301.4237, 4241.8618, 'closed', now() - interval '152 days', now() - interval '151 days'),
  (v_anas_id, 'BTCUSDT', 'sell', 62571.7708, 61601.3801, 'closed', now() - interval '61 days', now() - interval '59 days'),
  (v_anas_id, 'SOLUSDT', 'buy', 145.593222, 146.783538, 'closed', now() - interval '169 days', now() - interval '167 days'),
  (v_anas_id, 'GBPUSD', 'buy', 1.274766, 1.287697, 'closed', now() - interval '8 days', now() - interval '6 days'),
  (v_anas_id, 'USDJPY', 'buy', 154.971699, 157.37931, 'closed', now() - interval '176 days', now() - interval '174 days'),
  (v_anas_id, 'USDJPY', 'sell', 155.784133, 154.147323, 'closed', now() - interval '106 days', now() - interval '105 days'),
  (v_anas_id, 'BTCUSDT', 'sell', 63276.8277, 62556.3275, 'closed', now() - interval '40 days', now() - interval '39 days'),
  (v_anas_id, 'ETHUSDT', 'sell', 3389.301, 3360.2132, 'closed', now() - interval '143 days', now() - interval '142 days'),
  (v_anas_id, 'EURUSD', 'sell', 1.090365, 1.069011, 'closed', now() - interval '113 days', now() - interval '111 days'),
  (v_anas_id, 'GBPUSD', 'sell', 1.275566, 1.256122, 'closed', now() - interval '85 days', now() - interval '84 days'),
  (v_anas_id, 'XAUUSD', 'buy', 4328.5797, 4391.6676, 'closed', now() - interval '165 days', now() - interval '164 days'),
  (v_anas_id, 'XAUUSD', 'buy', 4328.6571, 4383.3395, 'closed', now() - interval '42 days', now() - interval '41 days'),
  (v_anas_id, 'ETHUSDT', 'sell', 3377.2416, 3313.8989, 'closed', now() - interval '98 days', now() - interval '96 days'),
  (v_anas_id, 'US30', 'sell', 39179.4545, 38710.3373, 'closed', now() - interval '138 days', now() - interval '136 days'),
  (v_anas_id, 'GBPUSD', 'sell', 1.265922, 1.273432, 'closed', now() - interval '142 days', now() - interval '141 days'),
  (v_anas_id, 'USDJPY', 'sell', 157.148134, 154.99642, 'closed', now() - interval '171 days', now() - interval '169 days'),
  (v_anas_id, 'BNBUSDT', 'buy', 575.491963, 586.21099, 'closed', now() - interval '139 days', now() - interval '138 days'),
  (v_anas_id, 'USDJPY', 'buy', 157.682182, 160.750973, 'closed', now() - interval '16 days', now() - interval '14 days'),
  (v_anas_id, 'GBPUSD', 'sell', 1.280949, 1.256171, 'closed', now() - interval '132 days', now() - interval '130 days'),
  (v_anas_id, 'XRPUSDT', 'buy', 0.615868, 0.621818, 'closed', now() - interval '42 days', now() - interval '40 days'),
  (v_anas_id, 'ETHUSDT', 'sell', 3426.5107, 3446.8956, 'closed', now() - interval '168 days', now() - interval '166 days'),
  (v_anas_id, 'BTCUSDT', 'sell', 63168.7031, 62616.5844, 'closed', now() - interval '25 days', now() - interval '24 days'),
  (v_anas_id, 'XRPUSDT', 'sell', 0.622923, 0.617253, 'closed', now() - interval '18 days', now() - interval '16 days'),
  (v_anas_id, 'GBPUSD', 'sell', 1.280173, 1.265123, 'closed', now() - interval '62 days', now() - interval '60 days'),
  (v_anas_id, 'BTCUSDT', 'buy', 62481.2724, 63078.6808, 'closed', now() - interval '140 days', now() - interval '138 days'),
  (v_anas_id, 'XRPUSDT', 'buy', 0.618034, 0.613228, 'closed', now() - interval '137 days', now() - interval '135 days'),
  (v_anas_id, 'XAUUSD', 'buy', 4323.0464, 4379.0501, 'closed', now() - interval '39 days', now() - interval '38 days'),
  (v_anas_id, 'US30', 'sell', 39181.5847, 38855.7633, 'closed', now() - interval '73 days', now() - interval '72 days'),
  (v_anas_id, 'BNBUSDT', 'sell', 573.971281, 568.360597, 'closed', now() - interval '131 days', now() - interval '130 days'),
  (v_anas_id, 'US30', 'buy', 39362.3527, 39053.2271, 'closed', now() - interval '19 days', now() - interval '18 days'),
  (v_anas_id, 'GBPUSD', 'buy', 1.258256, 1.270375, 'closed', now() - interval '90 days', now() - interval '88 days'),
  (v_anas_id, 'XAUUSD', 'buy', 4288.0159, 4252.0726, 'closed', now() - interval '8 days', now() - interval '6 days'),
  (v_anas_id, 'XAUUSD', 'sell', 4323.1261, 4251.1193, 'closed', now() - interval '42 days', now() - interval '41 days'),
  (v_anas_id, 'BTCUSDT', 'buy', 63397.7649, 64096.7586, 'closed', now() - interval '169 days', now() - interval '167 days'),
  (v_anas_id, 'BNBUSDT', 'buy', 565.922857, 572.117603, 'closed', now() - interval '57 days', now() - interval '55 days'),
  (v_anas_id, 'EURUSD', 'buy', 1.076518, 1.089968, 'closed', now() - interval '130 days', now() - interval '128 days'),
  (v_anas_id, 'SOLUSDT', 'buy', 144.282774, 145.870876, 'closed', now() - interval '7 days', now() - interval '6 days'),
  (v_anas_id, 'ETHUSDT', 'sell', 3426.8963, 3351.6536, 'closed', now() - interval '105 days', now() - interval '103 days'),
  (v_anas_id, 'ETHUSDT', 'buy', 3405.9315, 3440.3043, 'closed', now() - interval '142 days', now() - interval '141 days'),
  (v_anas_id, 'US30', 'sell', 38685.67, 38310.6867, 'closed', now() - interval '121 days', now() - interval '120 days');

  insert into public.signals (provider_id, symbol, side, entry_price, status, opened_at)
  values
  (v_anas_id, 'US30', 'sell', 39008.7297, 'open', now() - interval '12 hours'),
  (v_anas_id, 'XAUUSD', 'sell', 4329.1273, 'open', now() - interval '10 hours');

  insert into public.signals (provider_id, symbol, side, entry_price, exit_price, status, opened_at, closed_at)
  values
  (v_youssef_id, 'USDJPY', 'sell', 157.792398, 155.867234, 'closed', now() - interval '152 days', now() - interval '151 days'),
  (v_youssef_id, 'SOLUSDT', 'buy', 144.233934, 146.844689, 'closed', now() - interval '84 days', now() - interval '82 days'),
  (v_youssef_id, 'USDJPY', 'buy', 156.621506, 154.688689, 'closed', now() - interval '11 days', now() - interval '9 days'),
  (v_youssef_id, 'EURUSD', 'buy', 1.086212, 1.105506, 'closed', now() - interval '173 days', now() - interval '171 days'),
  (v_youssef_id, 'US30', 'buy', 39139.5761, 39509.4693, 'closed', now() - interval '136 days', now() - interval '134 days'),
  (v_youssef_id, 'USDJPY', 'sell', 157.351136, 155.128734, 'closed', now() - interval '124 days', now() - interval '122 days'),
  (v_youssef_id, 'SOLUSDT', 'sell', 144.667859, 142.93677, 'closed', now() - interval '79 days', now() - interval '77 days'),
  (v_youssef_id, 'BNBUSDT', 'buy', 574.10117, 581.912046, 'closed', now() - interval '15 days', now() - interval '14 days'),
  (v_youssef_id, 'USDJPY', 'sell', 156.684944, 153.457049, 'closed', now() - interval '15 days', now() - interval '14 days'),
  (v_youssef_id, 'GBPUSD', 'sell', 1.25941, 1.247329, 'closed', now() - interval '43 days', now() - interval '42 days'),
  (v_youssef_id, 'SOLUSDT', 'buy', 145.791793, 148.33787, 'closed', now() - interval '148 days', now() - interval '147 days'),
  (v_youssef_id, 'EURUSD', 'buy', 1.094717, 1.111768, 'closed', now() - interval '137 days', now() - interval '135 days'),
  (v_youssef_id, 'BTCUSDT', 'sell', 62608.9583, 61263.6833, 'closed', now() - interval '95 days', now() - interval '94 days'),
  (v_youssef_id, 'ETHUSDT', 'sell', 3377.885, 3403.4112, 'closed', now() - interval '175 days', now() - interval '174 days'),
  (v_youssef_id, 'USDJPY', 'sell', 156.087824, 153.890201, 'closed', now() - interval '18 days', now() - interval '17 days'),
  (v_youssef_id, 'BNBUSDT', 'sell', 573.416383, 564.256929, 'closed', now() - interval '176 days', now() - interval '174 days'),
  (v_youssef_id, 'GBPUSD', 'sell', 1.260698, 1.242919, 'closed', now() - interval '153 days', now() - interval '151 days'),
  (v_youssef_id, 'ETHUSDT', 'buy', 3399.2398, 3469.6626, 'closed', now() - interval '129 days', now() - interval '128 days'),
  (v_youssef_id, 'XRPUSDT', 'buy', 0.617444, 0.611614, 'closed', now() - interval '155 days', now() - interval '154 days'),
  (v_youssef_id, 'XAUUSD', 'buy', 4335.7712, 4415.4375, 'closed', now() - interval '64 days', now() - interval '62 days'),
  (v_youssef_id, 'EURUSD', 'sell', 1.079109, 1.094617, 'closed', now() - interval '140 days', now() - interval '139 days'),
  (v_youssef_id, 'XAUUSD', 'sell', 4290.5685, 4206.4947, 'closed', now() - interval '156 days', now() - interval '154 days'),
  (v_youssef_id, 'XAUUSD', 'sell', 4275.112, 4203.572, 'closed', now() - interval '147 days', now() - interval '145 days'),
  (v_youssef_id, 'US30', 'buy', 39025.7624, 39492.089, 'closed', now() - interval '71 days', now() - interval '69 days'),
  (v_youssef_id, 'SOLUSDT', 'sell', 144.812191, 142.216152, 'closed', now() - interval '114 days', now() - interval '112 days'),
  (v_youssef_id, 'USDJPY', 'buy', 156.666557, 158.150178, 'closed', now() - interval '12 days', now() - interval '10 days'),
  (v_youssef_id, 'SOLUSDT', 'buy', 144.956678, 147.375221, 'closed', now() - interval '38 days', now() - interval '37 days'),
  (v_youssef_id, 'BTCUSDT', 'buy', 62394.4153, 63309.8865, 'closed', now() - interval '160 days', now() - interval '159 days'),
  (v_youssef_id, 'GBPUSD', 'sell', 1.27752, 1.260172, 'closed', now() - interval '49 days', now() - interval '47 days'),
  (v_youssef_id, 'XRPUSDT', 'buy', 0.615857, 0.629296, 'closed', now() - interval '108 days', now() - interval '107 days'),
  (v_youssef_id, 'US30', 'buy', 38717.3299, 39300.3762, 'closed', now() - interval '150 days', now() - interval '149 days'),
  (v_youssef_id, 'ETHUSDT', 'buy', 3427.4898, 3492.1275, 'closed', now() - interval '39 days', now() - interval '38 days'),
  (v_youssef_id, 'BTCUSDT', 'sell', 63120.5646, 61941.9584, 'closed', now() - interval '103 days', now() - interval '101 days'),
  (v_youssef_id, 'US30', 'sell', 39147.1209, 38672.5973, 'closed', now() - interval '36 days', now() - interval '35 days'),
  (v_youssef_id, 'USDJPY', 'buy', 156.609765, 157.981793, 'closed', now() - interval '115 days', now() - interval '113 days'),
  (v_youssef_id, 'ETHUSDT', 'buy', 3410.9221, 3471.2685, 'closed', now() - interval '80 days', now() - interval '79 days'),
  (v_youssef_id, 'BTCUSDT', 'buy', 63134.2794, 63865.3544, 'closed', now() - interval '135 days', now() - interval '134 days'),
  (v_youssef_id, 'BNBUSDT', 'sell', 573.58007, 563.616608, 'closed', now() - interval '43 days', now() - interval '41 days'),
  (v_youssef_id, 'GBPUSD', 'sell', 1.282419, 1.266081, 'closed', now() - interval '169 days', now() - interval '167 days'),
  (v_youssef_id, 'USDJPY', 'sell', 155.346553, 152.952452, 'closed', now() - interval '142 days', now() - interval '141 days'),
  (v_youssef_id, 'SOLUSDT', 'sell', 143.565052, 140.863893, 'closed', now() - interval '24 days', now() - interval '23 days'),
  (v_youssef_id, 'USDJPY', 'sell', 157.184799, 158.29929, 'closed', now() - interval '72 days', now() - interval '71 days'),
  (v_youssef_id, 'BTCUSDT', 'sell', 63513.1189, 62859.5816, 'closed', now() - interval '43 days', now() - interval '41 days'),
  (v_youssef_id, 'USDJPY', 'sell', 156.509366, 153.763753, 'closed', now() - interval '79 days', now() - interval '77 days'),
  (v_youssef_id, 'XAUUSD', 'buy', 4296.0868, 4346.4377, 'closed', now() - interval '142 days', now() - interval '140 days'),
  (v_youssef_id, 'XRPUSDT', 'sell', 0.625731, 0.634831, 'closed', now() - interval '100 days', now() - interval '98 days'),
  (v_youssef_id, 'US30', 'buy', 39245.2227, 38866.2049, 'closed', now() - interval '135 days', now() - interval '133 days'),
  (v_youssef_id, 'US30', 'buy', 39335.8238, 38882.0933, 'closed', now() - interval '86 days', now() - interval '85 days'),
  (v_youssef_id, 'XAUUSD', 'sell', 4330.5177, 4384.8145, 'closed', now() - interval '174 days', now() - interval '172 days'),
  (v_youssef_id, 'GBPUSD', 'sell', 1.281821, 1.261334, 'closed', now() - interval '145 days', now() - interval '144 days'),
  (v_youssef_id, 'XAUUSD', 'sell', 4289.5492, 4245.1638, 'closed', now() - interval '124 days', now() - interval '122 days'),
  (v_youssef_id, 'GBPUSD', 'buy', 1.266001, 1.282755, 'closed', now() - interval '106 days', now() - interval '104 days'),
  (v_youssef_id, 'SOLUSDT', 'buy', 144.640857, 146.749515, 'closed', now() - interval '80 days', now() - interval '78 days'),
  (v_youssef_id, 'GBPUSD', 'buy', 1.267792, 1.285466, 'closed', now() - interval '51 days', now() - interval '50 days'),
  (v_youssef_id, 'EURUSD', 'sell', 1.09525, 1.071443, 'closed', now() - interval '166 days', now() - interval '165 days'),
  (v_youssef_id, 'EURUSD', 'buy', 1.086238, 1.102972, 'closed', now() - interval '31 days', now() - interval '30 days'),
  (v_youssef_id, 'ETHUSDT', 'buy', 3385.0813, 3424.3177, 'closed', now() - interval '44 days', now() - interval '43 days'),
  (v_youssef_id, 'EURUSD', 'sell', 1.086711, 1.070331, 'closed', now() - interval '56 days', now() - interval '54 days'),
  (v_youssef_id, 'US30', 'buy', 39142.0068, 38731.6155, 'closed', now() - interval '9 days', now() - interval '7 days'),
  (v_youssef_id, 'XAUUSD', 'buy', 4288.6375, 4346.1041, 'closed', now() - interval '12 days', now() - interval '10 days'),
  (v_youssef_id, 'GBPUSD', 'buy', 1.264531, 1.281697, 'closed', now() - interval '98 days', now() - interval '97 days'),
  (v_youssef_id, 'XRPUSDT', 'sell', 0.619798, 0.608819, 'closed', now() - interval '96 days', now() - interval '95 days'),
  (v_youssef_id, 'BNBUSDT', 'buy', 570.75508, 562.284438, 'closed', now() - interval '51 days', now() - interval '49 days'),
  (v_youssef_id, 'BNBUSDT', 'buy', 564.780462, 571.636245, 'closed', now() - interval '8 days', now() - interval '6 days'),
  (v_youssef_id, 'EURUSD', 'buy', 1.085209, 1.098408, 'closed', now() - interval '99 days', now() - interval '98 days'),
  (v_youssef_id, 'XAUUSD', 'buy', 4301.5945, 4379.7897, 'closed', now() - interval '167 days', now() - interval '165 days'),
  (v_youssef_id, 'EURUSD', 'buy', 1.085891, 1.096622, 'closed', now() - interval '173 days', now() - interval '172 days'),
  (v_youssef_id, 'SOLUSDT', 'buy', 143.657377, 145.15085, 'closed', now() - interval '21 days', now() - interval '20 days'),
  (v_youssef_id, 'XAUUSD', 'buy', 4319.2295, 4375.4669, 'closed', now() - interval '8 days', now() - interval '7 days'),
  (v_youssef_id, 'EURUSD', 'buy', 1.090008, 1.112455, 'closed', now() - interval '2 days', now() - interval '1 days'),
  (v_youssef_id, 'EURUSD', 'sell', 1.075217, 1.080746, 'closed', now() - interval '130 days', now() - interval '128 days'),
  (v_youssef_id, 'BTCUSDT', 'buy', 62771.7603, 63755.4087, 'closed', now() - interval '1 days', now() - interval '1 days'),
  (v_youssef_id, 'XRPUSDT', 'buy', 0.619697, 0.625356, 'closed', now() - interval '137 days', now() - interval '135 days'),
  (v_youssef_id, 'XRPUSDT', 'buy', 0.62028, 0.628487, 'closed', now() - interval '160 days', now() - interval '158 days'),
  (v_youssef_id, 'GBPUSD', 'sell', 1.267873, 1.246859, 'closed', now() - interval '111 days', now() - interval '109 days'),
  (v_youssef_id, 'GBPUSD', 'sell', 1.262993, 1.243178, 'closed', now() - interval '90 days', now() - interval '88 days'),
  (v_youssef_id, 'BTCUSDT', 'buy', 62422.2922, 63478.9874, 'closed', now() - interval '66 days', now() - interval '65 days'),
  (v_youssef_id, 'SOLUSDT', 'sell', 146.398781, 148.584013, 'closed', now() - interval '87 days', now() - interval '86 days'),
  (v_youssef_id, 'USDJPY', 'buy', 155.868669, 157.116704, 'closed', now() - interval '46 days', now() - interval '45 days'),
  (v_youssef_id, 'USDJPY', 'sell', 157.640282, 155.141224, 'closed', now() - interval '170 days', now() - interval '169 days'),
  (v_youssef_id, 'XAUUSD', 'sell', 4273.6539, 4209.6331, 'closed', now() - interval '76 days', now() - interval '74 days'),
  (v_youssef_id, 'BTCUSDT', 'sell', 62675.6709, 63034.2783, 'closed', now() - interval '160 days', now() - interval '158 days'),
  (v_youssef_id, 'XAUUSD', 'sell', 4328.4716, 4236.2269, 'closed', now() - interval '89 days', now() - interval '87 days'),
  (v_youssef_id, 'GBPUSD', 'buy', 1.268495, 1.284168, 'closed', now() - interval '67 days', now() - interval '66 days'),
  (v_youssef_id, 'XAUUSD', 'sell', 4333.1169, 4278.8106, 'closed', now() - interval '15 days', now() - interval '13 days'),
  (v_youssef_id, 'EURUSD', 'buy', 1.080785, 1.089703, 'closed', now() - interval '16 days', now() - interval '14 days'),
  (v_youssef_id, 'GBPUSD', 'buy', 1.279045, 1.289701, 'closed', now() - interval '31 days', now() - interval '29 days'),
  (v_youssef_id, 'EURUSD', 'sell', 1.088648, 1.069094, 'closed', now() - interval '53 days', now() - interval '52 days'),
  (v_youssef_id, 'XAUUSD', 'sell', 4314.5944, 4272.9864, 'closed', now() - interval '95 days', now() - interval '93 days'),
  (v_youssef_id, 'SOLUSDT', 'buy', 145.885401, 148.24662, 'closed', now() - interval '121 days', now() - interval '119 days'),
  (v_youssef_id, 'EURUSD', 'sell', 1.083583, 1.06716, 'closed', now() - interval '13 days', now() - interval '11 days'),
  (v_youssef_id, 'ETHUSDT', 'buy', 3400.19, 3468.842, 'closed', now() - interval '57 days', now() - interval '56 days'),
  (v_youssef_id, 'USDJPY', 'sell', 157.857071, 154.44536, 'closed', now() - interval '15 days', now() - interval '13 days'),
  (v_youssef_id, 'ETHUSDT', 'buy', 3429.7883, 3486.8646, 'closed', now() - interval '3 days', now() - interval '2 days'),
  (v_youssef_id, 'US30', 'buy', 39301.9479, 39751.2329, 'closed', now() - interval '133 days', now() - interval '132 days'),
  (v_youssef_id, 'US30', 'buy', 38769.1308, 38511.2654, 'closed', now() - interval '63 days', now() - interval '62 days'),
  (v_youssef_id, 'SOLUSDT', 'buy', 145.830952, 147.366101, 'closed', now() - interval '162 days', now() - interval '160 days'),
  (v_youssef_id, 'XRPUSDT', 'buy', 0.617233, 0.62333, 'closed', now() - interval '95 days', now() - interval '93 days'),
  (v_youssef_id, 'EURUSD', 'sell', 1.091838, 1.068356, 'closed', now() - interval '173 days', now() - interval '172 days'),
  (v_youssef_id, 'XRPUSDT', 'buy', 0.61418, 0.607808, 'closed', now() - interval '143 days', now() - interval '142 days');

  insert into public.signals (provider_id, symbol, side, entry_price, status, opened_at)
  values
  (v_youssef_id, 'GBPUSD', 'sell', 1.266745, 'open', now() - interval '4 hours'),
  (v_youssef_id, 'BNBUSDT', 'sell', 570.535415, 'open', now() - interval '1 hours');
end $$;

-- ---------- Keep Anas Rayan / Youssef Ali permanently low-risk ----------

create or replace function public.run_market_simulation()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_dow int;
  v_symbols text[] := array['BTCUSDT','ETHUSDT','XAUUSD','EURUSD','GBPUSD','USDJPY','SOLUSDT','BNBUSDT','XRPUSDT','US30'];
  v_base_prices numeric[] := array[62000, 3400, 2350, 1.085, 1.27, 156.5, 145, 570, 0.62, 39000];
  v_signal record;
  v_provider record;
  v_idx int;
  v_side text;
  v_entry numeric;
  v_move numeric;
  v_is_win boolean;
begin
  v_dow := extract(dow from now());
  if v_dow = 0 or v_dow = 6 then
    return;
  end if;

  for v_signal in
    select s.id, s.side, s.entry_price, coalesce(p.skill, 0.55) as skill, p.display_name
    from public.signals s
    join public.providers p on p.id = s.provider_id
    where s.status = 'open'
      and s.opened_at < now() - (floor(random() * 180 + 30) || ' minutes')::interval
    order by s.opened_at asc
    limit 40
  loop
    v_is_win := random() < v_signal.skill;
    if v_signal.display_name in ('أنس ريان', 'يوسف علي') then
      -- Calibrated flagship leaders: kept deliberately low-volatility
      -- ("مخاطرة منخفضة") regardless of the platform-wide profile below.
      if v_is_win then
        v_move := 0.008 + random() * 0.014; -- 0.8% - 2.2%
      else
        v_move := 0.005 + random() * 0.010; -- 0.5% - 1.5%
      end if;
    elsif v_is_win then
      v_move := 0.010 + random() * 0.080; -- 1.0% - 9.0% (avg ~5.0%)
    else
      v_move := 0.003 + random() * 0.022; -- 0.3% - 2.5% (avg ~1.4%)
    end if;
    update public.signals
    set status = 'closed',
        exit_price = round(
          case
            when (side = 'buy' and v_is_win) or (side = 'sell' and not v_is_win)
              then entry_price * (1 + v_move)
            else entry_price * (1 - v_move)
          end,
          4
        ),
        closed_at = now()
    where id = v_signal.id;
  end loop;

  for v_provider in
    select id from public.providers order by random() limit (5 + floor(random() * 10)::int)
  loop
    if random() < 0.4 then
      v_idx := 1 + floor(random() * array_length(v_symbols, 1))::int;
      v_side := case when random() < 0.5 then 'buy' else 'sell' end;
      v_entry := round((v_base_prices[v_idx] * (1 + (random() - 0.5) * 0.01))::numeric, 4);
      insert into public.signals (provider_id, symbol, side, entry_price, status, opened_at)
      values (v_provider.id, v_symbols[v_idx], v_side, v_entry, 'open', now());
    end if;
  end loop;

  update public.providers
  set base_followers_count = base_followers_count + floor(random() * 3)::int
  where user_id is null and random() < 0.3;

  update public.providers
  set total_profit = total_profit + round((random() * 500)::numeric, 2),
      total_withdrawals = total_withdrawals + round((random() * 150)::numeric, 2)
  where user_id is null and random() < 0.2;
end;
$function$;
