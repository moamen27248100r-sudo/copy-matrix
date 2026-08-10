-- ============================================================
-- Copy Matrix — أنس ريان and يوسف علي had nearly identical stats
-- (both ~82% win rate, ~1.6% avg return, same "low risk" bucket,
-- Youssef's bio literally described him as similar to Anas). Give
-- them genuinely distinct profiles while both stay top ("نخبة")
-- leaders: Anas stays the conservative, low-volatility risk manager
-- (82% win rate, low risk). Youssef becomes an aggressive, higher-
-- return / higher-volatility trader (71% win rate, high risk) — a
-- different style, not a clone. Trade histories are precomputed
-- (not sql random()) so win_rate_pct / avg_return_pct /
-- return_volatility / risk_level / tier are known in advance.
-- ============================================================

do $$
declare
  v_anas_id uuid;
  v_youssef_id uuid;
begin
  select id into v_anas_id from public.providers where display_name = 'أنس ريان';
  select id into v_youssef_id from public.providers where display_name = 'يوسف علي';

  -- Anas Rayan: unchanged conservative profile, skill matches his 82% win rate.
  update public.providers
  set skill = 0.82,
      bio = 'متداول محترف متخصص في إدارة المخاطر بدقة — عائد ثابت شهريًا بأقل تقلب ممكن، وسجل أداء موثّق بالكامل.'
  where id = v_anas_id;

  -- Youssef Ali: distinct aggressive profile — different win rate, return,
  -- risk level, follower base, minimum copy amount, and join date.
  update public.providers
  set skill = 0.71,
      bio = 'متداول جريء متخصص في صفقات الزخم قصيرة المدى على العملات الرقمية والمؤشرات — يستهدف عوائد أعلى ويقبل تقلبًا أكبر مقابلها، بأسلوب مختلف تمامًا عن إدارة المخاطر المحافظة.',
      base_followers_count = 195,
      min_copy_amount = 250,
      total_profit = 184920.00,
      total_withdrawals = 51200.00,
      created_at = timestamp '2024-06-18'
  where id = v_youssef_id;

  delete from public.signals where provider_id = v_anas_id;
  delete from public.signals where provider_id = v_youssef_id;

  insert into public.signals (provider_id, symbol, side, entry_price, exit_price, status, opened_at, closed_at)
  values
  (v_anas_id, 'XAUUSD', 'sell', 4342.4165, 4293.6361, 'closed', now() - interval '57 days', now() - interval '3 days'),
  (v_anas_id, 'ETHUSDT', 'sell', 3412.4683, 3347.8462, 'closed', now() - interval '33 days', now() - interval '3 days'),
  (v_anas_id, 'XRPUSDT', 'sell', 0.622587, 0.615403, 'closed', now() - interval '119 days', now() - interval '3 days'),
  (v_anas_id, 'GBPUSD', 'sell', 1.28233, 1.266366, 'closed', now() - interval '121 days', now() - interval '3 days'),
  (v_anas_id, 'SOLUSDT', 'sell', 145.290434, 146.729599, 'closed', now() - interval '125 days', now() - interval '1 days'),
  (v_anas_id, 'EURUSD', 'sell', 1.090438, 1.07695, 'closed', now() - interval '66 days', now() - interval '2 days'),
  (v_anas_id, 'GBPUSD', 'buy', 1.274994, 1.297913, 'closed', now() - interval '9 days', now() - interval '2 days'),
  (v_anas_id, 'US30', 'buy', 39037.962, 39913.8041, 'closed', now() - interval '98 days', now() - interval '1 days'),
  (v_anas_id, 'SOLUSDT', 'buy', 145.722329, 144.693011, 'closed', now() - interval '108 days', now() - interval '3 days'),
  (v_anas_id, 'XRPUSDT', 'sell', 0.620367, 0.624882, 'closed', now() - interval '131 days', now() - interval '2 days'),
  (v_anas_id, 'BNBUSDT', 'sell', 574.188594, 560.748238, 'closed', now() - interval '38 days', now() - interval '1 days'),
  (v_anas_id, 'GBPUSD', 'buy', 1.279448, 1.305495, 'closed', now() - interval '66 days', now() - interval '2 days'),
  (v_anas_id, 'ETHUSDT', 'sell', 3431.6408, 3392.7425, 'closed', now() - interval '61 days', now() - interval '2 days'),
  (v_anas_id, 'USDJPY', 'sell', 155.277154, 153.341964, 'closed', now() - interval '26 days', now() - interval '3 days'),
  (v_anas_id, 'ETHUSDT', 'buy', 3369.8062, 3428.6255, 'closed', now() - interval '11 days', now() - interval '1 days'),
  (v_anas_id, 'BNBUSDT', 'buy', 574.598543, 583.27459, 'closed', now() - interval '24 days', now() - interval '2 days'),
  (v_anas_id, 'XAUUSD', 'buy', 4274.2838, 4231.7596, 'closed', now() - interval '94 days', now() - interval '1 days'),
  (v_anas_id, 'ETHUSDT', 'buy', 3420.8919, 3478.1031, 'closed', now() - interval '70 days', now() - interval '2 days'),
  (v_anas_id, 'SOLUSDT', 'buy', 143.843892, 146.259912, 'closed', now() - interval '43 days', now() - interval '2 days'),
  (v_anas_id, 'BTCUSDT', 'sell', 63275.6389, 62537.5035, 'closed', now() - interval '108 days', now() - interval '3 days'),
  (v_anas_id, 'XAUUSD', 'sell', 4280.0257, 4226.6151, 'closed', now() - interval '84 days', now() - interval '1 days'),
  (v_anas_id, 'SOLUSDT', 'sell', 143.583042, 140.697697, 'closed', now() - interval '31 days', now() - interval '1 days'),
  (v_anas_id, 'EURUSD', 'buy', 1.091492, 1.103997, 'closed', now() - interval '139 days', now() - interval '1 days'),
  (v_anas_id, 'ETHUSDT', 'buy', 3423.9286, 3503.7273, 'closed', now() - interval '59 days', now() - interval '2 days'),
  (v_anas_id, 'XAUUSD', 'sell', 4283.6556, 4189.0383, 'closed', now() - interval '105 days', now() - interval '3 days'),
  (v_anas_id, 'USDJPY', 'sell', 155.968452, 157.691409, 'closed', now() - interval '99 days', now() - interval '2 days'),
  (v_anas_id, 'BTCUSDT', 'sell', 63149.4585, 62069.2145, 'closed', now() - interval '37 days', now() - interval '1 days'),
  (v_anas_id, 'USDJPY', 'sell', 157.317635, 159.113178, 'closed', now() - interval '124 days', now() - interval '2 days'),
  (v_anas_id, 'XAUUSD', 'sell', 4315.8413, 4253.429, 'closed', now() - interval '34 days', now() - interval '2 days'),
  (v_anas_id, 'ETHUSDT', 'buy', 3385.707, 3436.9265, 'closed', now() - interval '120 days', now() - interval '2 days'),
  (v_anas_id, 'ETHUSDT', 'buy', 3396.4157, 3458.3639, 'closed', now() - interval '124 days', now() - interval '3 days'),
  (v_anas_id, 'GBPUSD', 'buy', 1.277019, 1.297705, 'closed', now() - interval '53 days', now() - interval '1 days'),
  (v_anas_id, 'SOLUSDT', 'sell', 146.114957, 143.967318, 'closed', now() - interval '60 days', now() - interval '2 days'),
  (v_anas_id, 'EURUSD', 'sell', 1.090477, 1.071866, 'closed', now() - interval '35 days', now() - interval '2 days'),
  (v_anas_id, 'USDJPY', 'sell', 156.445372, 153.19303, 'closed', now() - interval '132 days', now() - interval '1 days'),
  (v_anas_id, 'US30', 'sell', 38787.1083, 39192.6715, 'closed', now() - interval '100 days', now() - interval '1 days'),
  (v_anas_id, 'GBPUSD', 'buy', 1.270646, 1.288542, 'closed', now() - interval '128 days', now() - interval '2 days'),
  (v_anas_id, 'XAUUSD', 'buy', 4301.1971, 4249.9754, 'closed', now() - interval '117 days', now() - interval '1 days'),
  (v_anas_id, 'USDJPY', 'buy', 157.878211, 160.681649, 'closed', now() - interval '60 days', now() - interval '2 days'),
  (v_anas_id, 'EURUSD', 'sell', 1.086177, 1.070353, 'closed', now() - interval '98 days', now() - interval '1 days'),
  (v_anas_id, 'USDJPY', 'buy', 156.330216, 159.170435, 'closed', now() - interval '28 days', now() - interval '3 days'),
  (v_anas_id, 'USDJPY', 'buy', 156.552613, 158.43985, 'closed', now() - interval '81 days', now() - interval '1 days'),
  (v_anas_id, 'USDJPY', 'buy', 154.969916, 157.57394, 'closed', now() - interval '36 days', now() - interval '1 days'),
  (v_anas_id, 'BNBUSDT', 'buy', 568.809057, 575.795103, 'closed', now() - interval '36 days', now() - interval '2 days'),
  (v_anas_id, 'SOLUSDT', 'buy', 144.00501, 146.59417, 'closed', now() - interval '133 days', now() - interval '1 days'),
  (v_anas_id, 'ETHUSDT', 'buy', 3368.8169, 3430.5395, 'closed', now() - interval '61 days', now() - interval '1 days'),
  (v_anas_id, 'XAUUSD', 'buy', 4314.7592, 4415.3967, 'closed', now() - interval '89 days', now() - interval '2 days'),
  (v_anas_id, 'BTCUSDT', 'buy', 62375.0509, 61527.2276, 'closed', now() - interval '107 days', now() - interval '2 days'),
  (v_anas_id, 'XRPUSDT', 'buy', 0.617064, 0.63116, 'closed', now() - interval '5 days', now() - interval '1 days'),
  (v_anas_id, 'XRPUSDT', 'sell', 0.622642, 0.611495, 'closed', now() - interval '86 days', now() - interval '1 days');

  insert into public.signals (provider_id, symbol, side, entry_price, status, opened_at)
  values
  (v_anas_id, 'XAUUSD', 'sell', 4265.7515, 'open', now() - interval '12 hours'),
  (v_anas_id, 'ETHUSDT', 'buy', 3428.8473, 'open', now() - interval '6 hours');

  insert into public.signals (provider_id, symbol, side, entry_price, exit_price, status, opened_at, closed_at)
  values
  (v_youssef_id, 'USDJPY', 'sell', 156.41657, 149.865691, 'closed', now() - interval '82 days', now() - interval '3 days'),
  (v_youssef_id, 'XAUUSD', 'buy', 4311.7963, 4483.8432, 'closed', now() - interval '51 days', now() - interval '2 days'),
  (v_youssef_id, 'ETHUSDT', 'buy', 3379.3492, 3514.6483, 'closed', now() - interval '136 days', now() - interval '2 days'),
  (v_youssef_id, 'BNBUSDT', 'sell', 565.836031, 543.224216, 'closed', now() - interval '11 days', now() - interval '2 days'),
  (v_youssef_id, 'BNBUSDT', 'sell', 572.813544, 549.085699, 'closed', now() - interval '80 days', now() - interval '3 days'),
  (v_youssef_id, 'SOLUSDT', 'buy', 144.595571, 143.503504, 'closed', now() - interval '138 days', now() - interval '1 days'),
  (v_youssef_id, 'XAUUSD', 'sell', 4265.9518, 4315.9742, 'closed', now() - interval '11 days', now() - interval '3 days'),
  (v_youssef_id, 'GBPUSD', 'sell', 1.281905, 1.231686, 'closed', now() - interval '8 days', now() - interval '3 days'),
  (v_youssef_id, 'XAUUSD', 'sell', 4321.2393, 4358.2275, 'closed', now() - interval '84 days', now() - interval '1 days'),
  (v_youssef_id, 'ETHUSDT', 'buy', 3393.7043, 3535.1694, 'closed', now() - interval '118 days', now() - interval '2 days'),
  (v_youssef_id, 'GBPUSD', 'sell', 1.259757, 1.27353, 'closed', now() - interval '110 days', now() - interval '1 days'),
  (v_youssef_id, 'XRPUSDT', 'buy', 0.614332, 0.640254, 'closed', now() - interval '57 days', now() - interval '2 days'),
  (v_youssef_id, 'GBPUSD', 'buy', 1.282596, 1.334841, 'closed', now() - interval '146 days', now() - interval '2 days'),
  (v_youssef_id, 'XRPUSDT', 'buy', 0.621074, 0.614932, 'closed', now() - interval '28 days', now() - interval '3 days'),
  (v_youssef_id, 'XAUUSD', 'sell', 4319.4339, 4366.9119, 'closed', now() - interval '131 days', now() - interval '2 days'),
  (v_youssef_id, 'BNBUSDT', 'buy', 569.886973, 565.737639, 'closed', now() - interval '58 days', now() - interval '1 days'),
  (v_youssef_id, 'GBPUSD', 'buy', 1.276248, 1.331115, 'closed', now() - interval '110 days', now() - interval '2 days'),
  (v_youssef_id, 'EURUSD', 'buy', 1.090312, 1.132495, 'closed', now() - interval '8 days', now() - interval '2 days'),
  (v_youssef_id, 'GBPUSD', 'sell', 1.270089, 1.217566, 'closed', now() - interval '125 days', now() - interval '1 days'),
  (v_youssef_id, 'XRPUSDT', 'sell', 0.62589, 0.5979, 'closed', now() - interval '66 days', now() - interval '3 days'),
  (v_youssef_id, 'US30', 'sell', 39175.8069, 37561.3616, 'closed', now() - interval '7 days', now() - interval '2 days'),
  (v_youssef_id, 'US30', 'sell', 38830.3232, 37168.3422, 'closed', now() - interval '30 days', now() - interval '2 days'),
  (v_youssef_id, 'US30', 'buy', 38768.9248, 40386.701, 'closed', now() - interval '86 days', now() - interval '3 days'),
  (v_youssef_id, 'XRPUSDT', 'sell', 0.615745, 0.591067, 'closed', now() - interval '89 days', now() - interval '2 days'),
  (v_youssef_id, 'XAUUSD', 'sell', 4328.6902, 4135.7554, 'closed', now() - interval '130 days', now() - interval '2 days'),
  (v_youssef_id, 'EURUSD', 'buy', 1.092934, 1.08234, 'closed', now() - interval '119 days', now() - interval '2 days'),
  (v_youssef_id, 'XRPUSDT', 'sell', 0.616835, 0.622807, 'closed', now() - interval '123 days', now() - interval '1 days'),
  (v_youssef_id, 'ETHUSDT', 'sell', 3366.1876, 3231.3548, 'closed', now() - interval '35 days', now() - interval '3 days'),
  (v_youssef_id, 'US30', 'sell', 39038.6962, 39419.0404, 'closed', now() - interval '3 days', now() - interval '1 days'),
  (v_youssef_id, 'US30', 'sell', 38636.7068, 37091.9398, 'closed', now() - interval '10 days', now() - interval '1 days'),
  (v_youssef_id, 'BTCUSDT', 'buy', 62952.3987, 65713.4446, 'closed', now() - interval '136 days', now() - interval '1 days'),
  (v_youssef_id, 'XAUUSD', 'buy', 4293.4542, 4484.8287, 'closed', now() - interval '66 days', now() - interval '2 days'),
  (v_youssef_id, 'ETHUSDT', 'buy', 3426.0694, 3564.7846, 'closed', now() - interval '133 days', now() - interval '1 days'),
  (v_youssef_id, 'USDJPY', 'sell', 156.33221, 149.880394, 'closed', now() - interval '119 days', now() - interval '2 days'),
  (v_youssef_id, 'EURUSD', 'buy', 1.092098, 1.079337, 'closed', now() - interval '108 days', now() - interval '2 days'),
  (v_youssef_id, 'EURUSD', 'sell', 1.077192, 1.031692, 'closed', now() - interval '129 days', now() - interval '2 days'),
  (v_youssef_id, 'BNBUSDT', 'buy', 575.250782, 598.104056, 'closed', now() - interval '95 days', now() - interval '3 days'),
  (v_youssef_id, 'XAUUSD', 'sell', 4315.4511, 4133.9011, 'closed', now() - interval '9 days', now() - interval '2 days'),
  (v_youssef_id, 'USDJPY', 'sell', 155.007351, 148.558351, 'closed', now() - interval '96 days', now() - interval '2 days'),
  (v_youssef_id, 'US30', 'buy', 38811.0416, 40419.2859, 'closed', now() - interval '63 days', now() - interval '2 days'),
  (v_youssef_id, 'USDJPY', 'sell', 156.411421, 157.771805, 'closed', now() - interval '135 days', now() - interval '3 days'),
  (v_youssef_id, 'USDJPY', 'sell', 157.386367, 150.657177, 'closed', now() - interval '95 days', now() - interval '1 days'),
  (v_youssef_id, 'USDJPY', 'buy', 157.562682, 164.274255, 'closed', now() - interval '129 days', now() - interval '2 days'),
  (v_youssef_id, 'USDJPY', 'buy', 155.949992, 161.979299, 'closed', now() - interval '45 days', now() - interval '2 days'),
  (v_youssef_id, 'BTCUSDT', 'sell', 62975.4086, 60486.4164, 'closed', now() - interval '138 days', now() - interval '2 days'),
  (v_youssef_id, 'US30', 'sell', 38923.274, 39264.5505, 'closed', now() - interval '127 days', now() - interval '2 days'),
  (v_youssef_id, 'BNBUSDT', 'buy', 573.225642, 567.914463, 'closed', now() - interval '86 days', now() - interval '1 days'),
  (v_youssef_id, 'GBPUSD', 'sell', 1.280745, 1.227545, 'closed', now() - interval '79 days', now() - interval '1 days'),
  (v_youssef_id, 'ETHUSDT', 'sell', 3389.2923, 3429.3606, 'closed', now() - interval '137 days', now() - interval '1 days'),
  (v_youssef_id, 'GBPUSD', 'sell', 1.281917, 1.294438, 'closed', now() - interval '77 days', now() - interval '3 days'),
  (v_youssef_id, 'ETHUSDT', 'buy', 3397.3443, 3363.4667, 'closed', now() - interval '89 days', now() - interval '3 days'),
  (v_youssef_id, 'BNBUSDT', 'sell', 573.182491, 551.125977, 'closed', now() - interval '82 days', now() - interval '1 days'),
  (v_youssef_id, 'ETHUSDT', 'sell', 3407.9681, 3265.5039, 'closed', now() - interval '118 days', now() - interval '2 days'),
  (v_youssef_id, 'SOLUSDT', 'buy', 146.215016, 152.721383, 'closed', now() - interval '130 days', now() - interval '2 days'),
  (v_youssef_id, 'USDJPY', 'sell', 156.108651, 149.222424, 'closed', now() - interval '10 days', now() - interval '2 days'),
  (v_youssef_id, 'ETHUSDT', 'sell', 3419.8285, 3286.1382, 'closed', now() - interval '86 days', now() - interval '1 days'),
  (v_youssef_id, 'XRPUSDT', 'sell', 0.62587, 0.599896, 'closed', now() - interval '66 days', now() - interval '3 days'),
  (v_youssef_id, 'USDJPY', 'buy', 156.420648, 162.882191, 'closed', now() - interval '70 days', now() - interval '1 days'),
  (v_youssef_id, 'XAUUSD', 'sell', 4335.2614, 4156.3638, 'closed', now() - interval '146 days', now() - interval '2 days'),
  (v_youssef_id, 'ETHUSDT', 'sell', 3374.7282, 3406.8714, 'closed', now() - interval '30 days', now() - interval '3 days'),
  (v_youssef_id, 'USDJPY', 'sell', 155.43694, 148.494193, 'closed', now() - interval '35 days', now() - interval '2 days'),
  (v_youssef_id, 'XAUUSD', 'buy', 4297.1155, 4472.3866, 'closed', now() - interval '77 days', now() - interval '1 days'),
  (v_youssef_id, 'SOLUSDT', 'sell', 143.558363, 137.877872, 'closed', now() - interval '65 days', now() - interval '1 days'),
  (v_youssef_id, 'BNBUSDT', 'sell', 568.970578, 574.001803, 'closed', now() - interval '19 days', now() - interval '2 days'),
  (v_youssef_id, 'SOLUSDT', 'sell', 144.086513, 137.777152, 'closed', now() - interval '49 days', now() - interval '3 days');

  insert into public.signals (provider_id, symbol, side, entry_price, status, opened_at)
  values
  (v_youssef_id, 'XAUUSD', 'buy', 4315.6358, 'open', now() - interval '4 hours'),
  (v_youssef_id, 'XRPUSDT', 'buy', 0.615381, 'open', now() - interval '3 hours');
end $$;
