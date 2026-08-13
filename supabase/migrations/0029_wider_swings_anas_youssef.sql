-- ============================================================
-- Copy Matrix — recalibrate Anas Rayan and Youssef Ali's trade
-- histories with wider, more realistic per-trade swings (up to ~5%
-- on a winning trade, losses capped at ~5%) instead of the previous
-- tight 1-2% moves. Anas Rayan keeps his 82% win rate; Youssef Ali's
-- win rate moves to exactly 84% per request. Trade histories are
-- precomputed (not sql random()) so win_rate_pct / avg_return_pct /
-- return_volatility are known exactly in advance.
-- ============================================================

do $$
declare
  v_anas_id uuid;
  v_youssef_id uuid;
begin
  select id into v_anas_id from public.providers where display_name = 'أنس ريان';
  select id into v_youssef_id from public.providers where display_name = 'يوسف علي';

  update public.providers set skill = 0.82 where id = v_anas_id;
  update public.providers set skill = 0.84 where id = v_youssef_id;

  delete from public.signals where provider_id = v_anas_id;
  delete from public.signals where provider_id = v_youssef_id;

  insert into public.signals (provider_id, symbol, side, entry_price, exit_price, status, opened_at, closed_at)
  values
  (v_anas_id, 'GBPUSD', 'sell', 1.263301, 1.23185, 'closed', now() - interval '139 days', now() - interval '3 days'),
  (v_anas_id, 'BNBUSDT', 'sell', 569.198363, 560.189958, 'closed', now() - interval '28 days', now() - interval '2 days'),
  (v_anas_id, 'XAUUSD', 'buy', 4275.008, 4479.1836, 'closed', now() - interval '128 days', now() - interval '1 days'),
  (v_anas_id, 'USDJPY', 'sell', 157.208414, 154.39196, 'closed', now() - interval '142 days', now() - interval '2 days'),
  (v_anas_id, 'XRPUSDT', 'buy', 0.621461, 0.645832, 'closed', now() - interval '104 days', now() - interval '3 days'),
  (v_anas_id, 'BNBUSDT', 'buy', 573.709658, 550.87926, 'closed', now() - interval '22 days', now() - interval '3 days'),
  (v_anas_id, 'BNBUSDT', 'sell', 573.82366, 566.399679, 'closed', now() - interval '15 days', now() - interval '1 days'),
  (v_anas_id, 'US30', 'buy', 38776.8122, 36890.9285, 'closed', now() - interval '143 days', now() - interval '1 days'),
  (v_anas_id, 'XAUUSD', 'sell', 4258.779, 4130.4473, 'closed', now() - interval '90 days', now() - interval '2 days'),
  (v_anas_id, 'ETHUSDT', 'buy', 3421.9512, 3487.2439, 'closed', now() - interval '44 days', now() - interval '2 days'),
  (v_anas_id, 'USDJPY', 'sell', 156.216492, 154.413115, 'closed', now() - interval '15 days', now() - interval '1 days'),
  (v_anas_id, 'BTCUSDT', 'sell', 63212.737, 60903.1222, 'closed', now() - interval '89 days', now() - interval '1 days'),
  (v_anas_id, 'XAUUSD', 'buy', 4304.3485, 4394.6901, 'closed', now() - interval '59 days', now() - interval '1 days'),
  (v_anas_id, 'USDJPY', 'sell', 156.62339, 154.498091, 'closed', now() - interval '65 days', now() - interval '1 days'),
  (v_anas_id, 'XRPUSDT', 'buy', 0.625191, 0.603327, 'closed', now() - interval '29 days', now() - interval '2 days'),
  (v_anas_id, 'EURUSD', 'sell', 1.08889, 1.057662, 'closed', now() - interval '90 days', now() - interval '2 days'),
  (v_anas_id, 'BTCUSDT', 'buy', 62691.6261, 64129.6955, 'closed', now() - interval '125 days', now() - interval '2 days'),
  (v_anas_id, 'BTCUSDT', 'buy', 62630.479, 64039.6559, 'closed', now() - interval '73 days', now() - interval '2 days'),
  (v_anas_id, 'GBPUSD', 'buy', 1.282079, 1.343362, 'closed', now() - interval '142 days', now() - interval '2 days'),
  (v_anas_id, 'SOLUSDT', 'sell', 145.509009, 139.277485, 'closed', now() - interval '18 days', now() - interval '3 days'),
  (v_anas_id, 'GBPUSD', 'sell', 1.259363, 1.196911, 'closed', now() - interval '148 days', now() - interval '1 days'),
  (v_anas_id, 'USDJPY', 'sell', 156.045747, 149.893394, 'closed', now() - interval '8 days', now() - interval '1 days'),
  (v_anas_id, 'ETHUSDT', 'sell', 3408.8818, 3356.5937, 'closed', now() - interval '77 days', now() - interval '1 days'),
  (v_anas_id, 'SOLUSDT', 'sell', 146.165165, 141.461636, 'closed', now() - interval '143 days', now() - interval '3 days'),
  (v_anas_id, 'BNBUSDT', 'buy', 565.606761, 558.88491, 'closed', now() - interval '19 days', now() - interval '2 days'),
  (v_anas_id, 'XRPUSDT', 'buy', 0.625364, 0.601562, 'closed', now() - interval '39 days', now() - interval '2 days'),
  (v_anas_id, 'XRPUSDT', 'buy', 0.622282, 0.641931, 'closed', now() - interval '18 days', now() - interval '3 days'),
  (v_anas_id, 'BTCUSDT', 'sell', 62444.4899, 61036.1519, 'closed', now() - interval '132 days', now() - interval '3 days'),
  (v_anas_id, 'XRPUSDT', 'buy', 0.624201, 0.633528, 'closed', now() - interval '56 days', now() - interval '1 days'),
  (v_anas_id, 'US30', 'sell', 38665.6842, 37858.9365, 'closed', now() - interval '122 days', now() - interval '2 days'),
  (v_anas_id, 'BNBUSDT', 'buy', 569.977149, 584.573357, 'closed', now() - interval '93 days', now() - interval '1 days'),
  (v_anas_id, 'EURUSD', 'buy', 1.089591, 1.142737, 'closed', now() - interval '67 days', now() - interval '3 days'),
  (v_anas_id, 'XAUUSD', 'buy', 4302.643, 4139.603, 'closed', now() - interval '94 days', now() - interval '2 days'),
  (v_anas_id, 'XRPUSDT', 'sell', 0.618129, 0.642892, 'closed', now() - interval '85 days', now() - interval '1 days'),
  (v_anas_id, 'USDJPY', 'sell', 155.177377, 151.197139, 'closed', now() - interval '121 days', now() - interval '1 days'),
  (v_anas_id, 'SOLUSDT', 'buy', 145.281233, 146.934145, 'closed', now() - interval '117 days', now() - interval '1 days'),
  (v_anas_id, 'XAUUSD', 'buy', 4319.9963, 4433.4854, 'closed', now() - interval '44 days', now() - interval '1 days'),
  (v_anas_id, 'BTCUSDT', 'buy', 62638.5464, 64738.0524, 'closed', now() - interval '138 days', now() - interval '1 days'),
  (v_anas_id, 'EURUSD', 'sell', 1.083296, 1.03755, 'closed', now() - interval '112 days', now() - interval '2 days'),
  (v_anas_id, 'SOLUSDT', 'sell', 144.55871, 138.274327, 'closed', now() - interval '34 days', now() - interval '3 days'),
  (v_anas_id, 'EURUSD', 'sell', 1.08644, 1.075328, 'closed', now() - interval '147 days', now() - interval '2 days'),
  (v_anas_id, 'XRPUSDT', 'buy', 0.616884, 0.631112, 'closed', now() - interval '53 days', now() - interval '2 days'),
  (v_anas_id, 'USDJPY', 'buy', 156.057172, 153.591954, 'closed', now() - interval '37 days', now() - interval '3 days'),
  (v_anas_id, 'GBPUSD', 'sell', 1.26482, 1.203098, 'closed', now() - interval '70 days', now() - interval '2 days'),
  (v_anas_id, 'XAUUSD', 'buy', 4257.897, 4321.7558, 'closed', now() - interval '5 days', now() - interval '2 days'),
  (v_anas_id, 'USDJPY', 'sell', 157.722388, 155.47233, 'closed', now() - interval '84 days', now() - interval '1 days'),
  (v_anas_id, 'XAUUSD', 'sell', 4317.5433, 4444.9453, 'closed', now() - interval '142 days', now() - interval '1 days'),
  (v_anas_id, 'ETHUSDT', 'sell', 3415.8961, 3374.0051, 'closed', now() - interval '135 days', now() - interval '2 days'),
  (v_anas_id, 'EURUSD', 'buy', 1.092708, 1.111103, 'closed', now() - interval '124 days', now() - interval '1 days'),
  (v_anas_id, 'ETHUSDT', 'buy', 3372.8621, 3539.9137, 'closed', now() - interval '67 days', now() - interval '2 days');

  insert into public.signals (provider_id, symbol, side, entry_price, status, opened_at)
  values
  (v_anas_id, 'BTCUSDT', 'sell', 62842.288, 'open', now() - interval '6 hours'),
  (v_anas_id, 'BTCUSDT', 'sell', 63554.1655, 'open', now() - interval '9 hours');

  insert into public.signals (provider_id, symbol, side, entry_price, exit_price, status, opened_at, closed_at)
  values
  (v_youssef_id, 'ETHUSDT', 'buy', 3433.1971, 3548.9143, 'closed', now() - interval '27 days', now() - interval '1 days'),
  (v_youssef_id, 'XAUUSD', 'sell', 4277.484, 4139.9666, 'closed', now() - interval '144 days', now() - interval '1 days'),
  (v_youssef_id, 'SOLUSDT', 'sell', 143.712482, 140.802882, 'closed', now() - interval '47 days', now() - interval '3 days'),
  (v_youssef_id, 'GBPUSD', 'buy', 1.275341, 1.313866, 'closed', now() - interval '75 days', now() - interval '1 days'),
  (v_youssef_id, 'EURUSD', 'buy', 1.087088, 1.033301, 'closed', now() - interval '38 days', now() - interval '1 days'),
  (v_youssef_id, 'SOLUSDT', 'buy', 144.504282, 149.106518, 'closed', now() - interval '148 days', now() - interval '2 days'),
  (v_youssef_id, 'USDJPY', 'sell', 156.822293, 154.543173, 'closed', now() - interval '152 days', now() - interval '2 days'),
  (v_youssef_id, 'XRPUSDT', 'sell', 0.614369, 0.598392, 'closed', now() - interval '149 days', now() - interval '1 days'),
  (v_youssef_id, 'SOLUSDT', 'buy', 145.40783, 147.09282, 'closed', now() - interval '128 days', now() - interval '1 days'),
  (v_youssef_id, 'XRPUSDT', 'buy', 0.624358, 0.654985, 'closed', now() - interval '26 days', now() - interval '1 days'),
  (v_youssef_id, 'BTCUSDT', 'buy', 63284.2927, 61277.8248, 'closed', now() - interval '81 days', now() - interval '3 days'),
  (v_youssef_id, 'GBPUSD', 'sell', 1.266032, 1.21712, 'closed', now() - interval '54 days', now() - interval '2 days'),
  (v_youssef_id, 'ETHUSDT', 'buy', 3411.8798, 3351.1394, 'closed', now() - interval '70 days', now() - interval '2 days'),
  (v_youssef_id, 'US30', 'buy', 38835.4658, 37457.0409, 'closed', now() - interval '83 days', now() - interval '3 days'),
  (v_youssef_id, 'ETHUSDT', 'sell', 3374.0362, 3262.2539, 'closed', now() - interval '7 days', now() - interval '1 days'),
  (v_youssef_id, 'BTCUSDT', 'sell', 62637.9679, 59971.0731, 'closed', now() - interval '35 days', now() - interval '2 days'),
  (v_youssef_id, 'ETHUSDT', 'buy', 3393.2598, 3472.2197, 'closed', now() - interval '91 days', now() - interval '1 days'),
  (v_youssef_id, 'BNBUSDT', 'buy', 569.405917, 581.943579, 'closed', now() - interval '98 days', now() - interval '3 days'),
  (v_youssef_id, 'BTCUSDT', 'buy', 63385.4987, 65352.2966, 'closed', now() - interval '133 days', now() - interval '1 days'),
  (v_youssef_id, 'SOLUSDT', 'sell', 145.024319, 137.896622, 'closed', now() - interval '96 days', now() - interval '2 days'),
  (v_youssef_id, 'BNBUSDT', 'sell', 565.953311, 549.714796, 'closed', now() - interval '16 days', now() - interval '1 days'),
  (v_youssef_id, 'US30', 'buy', 39194.3693, 41132.0377, 'closed', now() - interval '22 days', now() - interval '2 days'),
  (v_youssef_id, 'SOLUSDT', 'buy', 146.28952, 150.130326, 'closed', now() - interval '12 days', now() - interval '3 days'),
  (v_youssef_id, 'GBPUSD', 'buy', 1.278047, 1.336933, 'closed', now() - interval '77 days', now() - interval '1 days'),
  (v_youssef_id, 'USDJPY', 'buy', 156.806299, 160.312646, 'closed', now() - interval '111 days', now() - interval '2 days'),
  (v_youssef_id, 'US30', 'buy', 38639.3142, 39807.7807, 'closed', now() - interval '121 days', now() - interval '1 days'),
  (v_youssef_id, 'EURUSD', 'sell', 1.093235, 1.047896, 'closed', now() - interval '117 days', now() - interval '1 days'),
  (v_youssef_id, 'XAUUSD', 'buy', 4264.7993, 4469.3263, 'closed', now() - interval '131 days', now() - interval '1 days'),
  (v_youssef_id, 'XAUUSD', 'sell', 4293.5826, 4185.7875, 'closed', now() - interval '136 days', now() - interval '1 days'),
  (v_youssef_id, 'XAUUSD', 'buy', 4261.4747, 4329.0518, 'closed', now() - interval '33 days', now() - interval '2 days'),
  (v_youssef_id, 'XAUUSD', 'buy', 4297.1826, 4211.2952, 'closed', now() - interval '37 days', now() - interval '3 days'),
  (v_youssef_id, 'US30', 'buy', 38987.4733, 37133.5562, 'closed', now() - interval '61 days', now() - interval '2 days'),
  (v_youssef_id, 'XAUUSD', 'buy', 4327.3059, 4469.7255, 'closed', now() - interval '109 days', now() - interval '3 days'),
  (v_youssef_id, 'GBPUSD', 'buy', 1.267454, 1.32717, 'closed', now() - interval '140 days', now() - interval '2 days'),
  (v_youssef_id, 'XRPUSDT', 'sell', 0.615347, 0.595548, 'closed', now() - interval '76 days', now() - interval '1 days'),
  (v_youssef_id, 'GBPUSD', 'buy', 1.273527, 1.306583, 'closed', now() - interval '63 days', now() - interval '3 days'),
  (v_youssef_id, 'GBPUSD', 'sell', 1.270871, 1.299274, 'closed', now() - interval '141 days', now() - interval '2 days'),
  (v_youssef_id, 'BNBUSDT', 'buy', 570.079715, 598.318945, 'closed', now() - interval '142 days', now() - interval '2 days'),
  (v_youssef_id, 'SOLUSDT', 'sell', 145.729109, 140.486699, 'closed', now() - interval '113 days', now() - interval '1 days'),
  (v_youssef_id, 'SOLUSDT', 'sell', 144.742021, 139.968329, 'closed', now() - interval '32 days', now() - interval '1 days'),
  (v_youssef_id, 'XRPUSDT', 'buy', 0.614504, 0.634672, 'closed', now() - interval '75 days', now() - interval '1 days'),
  (v_youssef_id, 'EURUSD', 'sell', 1.07448, 1.030165, 'closed', now() - interval '62 days', now() - interval '1 days'),
  (v_youssef_id, 'GBPUSD', 'buy', 1.272209, 1.301526, 'closed', now() - interval '10 days', now() - interval '3 days'),
  (v_youssef_id, 'EURUSD', 'sell', 1.088546, 1.061778, 'closed', now() - interval '79 days', now() - interval '1 days'),
  (v_youssef_id, 'USDJPY', 'buy', 156.246606, 161.239653, 'closed', now() - interval '42 days', now() - interval '3 days'),
  (v_youssef_id, 'GBPUSD', 'sell', 1.268749, 1.246012, 'closed', now() - interval '146 days', now() - interval '2 days'),
  (v_youssef_id, 'BNBUSDT', 'sell', 573.566792, 551.038803, 'closed', now() - interval '44 days', now() - interval '2 days'),
  (v_youssef_id, 'US30', 'sell', 39167.0002, 37930.1233, 'closed', now() - interval '44 days', now() - interval '1 days'),
  (v_youssef_id, 'BTCUSDT', 'buy', 62949.4555, 61337.8384, 'closed', now() - interval '46 days', now() - interval '3 days'),
  (v_youssef_id, 'BNBUSDT', 'sell', 574.485234, 562.702461, 'closed', now() - interval '48 days', now() - interval '3 days');

  insert into public.signals (provider_id, symbol, side, entry_price, status, opened_at)
  values
  (v_youssef_id, 'EURUSD', 'buy', 1.089899, 'open', now() - interval '12 hours'),
  (v_youssef_id, 'XRPUSDT', 'sell', 0.622049, 'open', now() - interval '5 hours');
end $$;
