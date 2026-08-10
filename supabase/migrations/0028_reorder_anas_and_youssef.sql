-- ============================================================
-- Copy Matrix — the default trader listing sorts by highest return,
-- and after the last recalibration يوسف علي (2.65%) actually ranked
-- ABOVE أنس ريان (1.18%), putting Youssef first instead of Anas.
-- Requested: Anas Rayan must be #1 in the default listing, Youssef
-- Ali should land around #3 (not right next to Anas), and every stat
-- between them should read as genuinely different — win rate, trade
-- count, followers, risk profile, tier. Anas becomes the clear
-- platform-wide #1 by avg return, staying "نخبة" tier / low risk.
-- Youssef's avg return is retargeted to land precisely between
-- رغد البلوي (1.265101%) and نادية الدوسري (1.251198%), so he lands
-- at rank #3 under the default sort, while his win rate, volatility
-- (high risk) and trade count stay clearly distinct from Anas —
-- landing him in a different tier ("محترف") entirely. Trade
-- histories are precomputed (not sql random()) so win_rate_pct /
-- avg_return_pct / return_volatility / tier / rank are known exactly.
-- ============================================================

do $$
declare
  v_anas_id uuid;
  v_youssef_id uuid;
begin
  select id into v_anas_id from public.providers where display_name = 'أنس ريان';
  select id into v_youssef_id from public.providers where display_name = 'يوسف علي';

  update public.providers
  set base_followers_count = 310
  where id = v_anas_id;

  update public.providers
  set skill = 0.68,
      base_followers_count = 150
  where id = v_youssef_id;

  delete from public.signals where provider_id = v_anas_id;
  delete from public.signals where provider_id = v_youssef_id;

  insert into public.signals (provider_id, symbol, side, entry_price, exit_price, status, opened_at, closed_at)
  values
  (v_anas_id, 'BTCUSDT', 'sell', 62798.2955, 60447.0676, 'closed', now() - interval '42 days', now() - interval '2 days'),
  (v_anas_id, 'SOLUSDT', 'buy', 145.77448, 151.19519, 'closed', now() - interval '84 days', now() - interval '2 days'),
  (v_anas_id, 'US30', 'sell', 38746.2602, 37693.3389, 'closed', now() - interval '138 days', now() - interval '2 days'),
  (v_anas_id, 'XAUUSD', 'buy', 4315.7391, 4456.2813, 'closed', now() - interval '32 days', now() - interval '1 days'),
  (v_anas_id, 'GBPUSD', 'buy', 1.257494, 1.30241, 'closed', now() - interval '106 days', now() - interval '2 days'),
  (v_anas_id, 'ETHUSDT', 'sell', 3424.5087, 3316.9664, 'closed', now() - interval '137 days', now() - interval '3 days'),
  (v_anas_id, 'XRPUSDT', 'sell', 0.624788, 0.61571, 'closed', now() - interval '62 days', now() - interval '2 days'),
  (v_anas_id, 'GBPUSD', 'sell', 1.271323, 1.288214, 'closed', now() - interval '131 days', now() - interval '3 days'),
  (v_anas_id, 'USDJPY', 'sell', 156.859031, 158.989335, 'closed', now() - interval '91 days', now() - interval '2 days'),
  (v_anas_id, 'BNBUSDT', 'sell', 573.077861, 552.439574, 'closed', now() - interval '82 days', now() - interval '1 days'),
  (v_anas_id, 'EURUSD', 'sell', 1.089138, 1.053732, 'closed', now() - interval '114 days', now() - interval '1 days'),
  (v_anas_id, 'SOLUSDT', 'sell', 145.749861, 143.189639, 'closed', now() - interval '37 days', now() - interval '1 days'),
  (v_anas_id, 'XRPUSDT', 'sell', 0.621011, 0.597902, 'closed', now() - interval '25 days', now() - interval '3 days'),
  (v_anas_id, 'US30', 'sell', 38771.4247, 37357.7527, 'closed', now() - interval '112 days', now() - interval '2 days'),
  (v_anas_id, 'USDJPY', 'sell', 155.914439, 151.369936, 'closed', now() - interval '95 days', now() - interval '2 days'),
  (v_anas_id, 'SOLUSDT', 'buy', 145.874584, 144.228226, 'closed', now() - interval '149 days', now() - interval '2 days'),
  (v_anas_id, 'EURUSD', 'sell', 1.093368, 1.051421, 'closed', now() - interval '53 days', now() - interval '2 days'),
  (v_anas_id, 'EURUSD', 'buy', 1.08166, 1.121535, 'closed', now() - interval '29 days', now() - interval '3 days'),
  (v_anas_id, 'USDJPY', 'buy', 157.437474, 156.080969, 'closed', now() - interval '45 days', now() - interval '1 days'),
  (v_anas_id, 'GBPUSD', 'buy', 1.278499, 1.297166, 'closed', now() - interval '73 days', now() - interval '2 days'),
  (v_anas_id, 'US30', 'buy', 38757.8535, 39431.8488, 'closed', now() - interval '21 days', now() - interval '3 days'),
  (v_anas_id, 'USDJPY', 'sell', 156.562802, 153.069082, 'closed', now() - interval '95 days', now() - interval '3 days'),
  (v_anas_id, 'BNBUSDT', 'sell', 574.058085, 552.328044, 'closed', now() - interval '113 days', now() - interval '1 days'),
  (v_anas_id, 'XAUUSD', 'buy', 4260.2486, 4217.1402, 'closed', now() - interval '29 days', now() - interval '2 days'),
  (v_anas_id, 'SOLUSDT', 'sell', 146.233625, 147.419202, 'closed', now() - interval '72 days', now() - interval '2 days'),
  (v_anas_id, 'XAUUSD', 'sell', 4289.6684, 4163.4809, 'closed', now() - interval '146 days', now() - interval '1 days'),
  (v_anas_id, 'XRPUSDT', 'sell', 0.614477, 0.601033, 'closed', now() - interval '75 days', now() - interval '3 days'),
  (v_anas_id, 'BTCUSDT', 'sell', 62803.49, 63656.4327, 'closed', now() - interval '110 days', now() - interval '2 days'),
  (v_anas_id, 'XAUUSD', 'sell', 4297.9132, 4215.6782, 'closed', now() - interval '123 days', now() - interval '2 days'),
  (v_anas_id, 'BTCUSDT', 'sell', 63322.0664, 61327.4202, 'closed', now() - interval '39 days', now() - interval '2 days'),
  (v_anas_id, 'BNBUSDT', 'sell', 570.671771, 555.768222, 'closed', now() - interval '79 days', now() - interval '3 days'),
  (v_anas_id, 'EURUSD', 'buy', 1.075773, 1.113699, 'closed', now() - interval '69 days', now() - interval '2 days'),
  (v_anas_id, 'USDJPY', 'sell', 155.747941, 152.656964, 'closed', now() - interval '19 days', now() - interval '1 days'),
  (v_anas_id, 'USDJPY', 'buy', 156.959031, 161.731674, 'closed', now() - interval '69 days', now() - interval '3 days'),
  (v_anas_id, 'XRPUSDT', 'sell', 0.623834, 0.599252, 'closed', now() - interval '52 days', now() - interval '3 days'),
  (v_anas_id, 'EURUSD', 'buy', 1.084846, 1.107853, 'closed', now() - interval '143 days', now() - interval '1 days'),
  (v_anas_id, 'SOLUSDT', 'sell', 144.406848, 142.144985, 'closed', now() - interval '15 days', now() - interval '3 days'),
  (v_anas_id, 'BNBUSDT', 'buy', 564.677718, 573.950722, 'closed', now() - interval '148 days', now() - interval '3 days'),
  (v_anas_id, 'XRPUSDT', 'buy', 0.625516, 0.632659, 'closed', now() - interval '71 days', now() - interval '1 days'),
  (v_anas_id, 'SOLUSDT', 'buy', 144.389161, 150.008632, 'closed', now() - interval '25 days', now() - interval '1 days'),
  (v_anas_id, 'XRPUSDT', 'buy', 0.622023, 0.645003, 'closed', now() - interval '135 days', now() - interval '3 days'),
  (v_anas_id, 'XRPUSDT', 'buy', 0.621971, 0.632897, 'closed', now() - interval '123 days', now() - interval '1 days'),
  (v_anas_id, 'GBPUSD', 'sell', 1.269464, 1.250508, 'closed', now() - interval '92 days', now() - interval '3 days'),
  (v_anas_id, 'EURUSD', 'buy', 1.078771, 1.095139, 'closed', now() - interval '141 days', now() - interval '1 days'),
  (v_anas_id, 'EURUSD', 'buy', 1.08316, 1.116697, 'closed', now() - interval '61 days', now() - interval '1 days'),
  (v_anas_id, 'XRPUSDT', 'buy', 0.615811, 0.625691, 'closed', now() - interval '118 days', now() - interval '1 days'),
  (v_anas_id, 'GBPUSD', 'sell', 1.27172, 1.282779, 'closed', now() - interval '117 days', now() - interval '2 days'),
  (v_anas_id, 'BTCUSDT', 'sell', 62726.7792, 60763.1497, 'closed', now() - interval '69 days', now() - interval '1 days'),
  (v_anas_id, 'US30', 'buy', 38971.8113, 40127.1224, 'closed', now() - interval '59 days', now() - interval '2 days'),
  (v_anas_id, 'XAUUSD', 'buy', 4270.9306, 4231.6314, 'closed', now() - interval '85 days', now() - interval '3 days');

  insert into public.signals (provider_id, symbol, side, entry_price, status, opened_at)
  values
  (v_anas_id, 'BNBUSDT', 'sell', 570.74495, 'open', now() - interval '5 hours'),
  (v_anas_id, 'US30', 'buy', 39190.9841, 'open', now() - interval '11 hours');

  insert into public.signals (provider_id, symbol, side, entry_price, exit_price, status, opened_at, closed_at)
  values
  (v_youssef_id, 'USDJPY', 'buy', 156.734512, 153.62652, 'closed', now() - interval '61 days', now() - interval '3 days'),
  (v_youssef_id, 'US30', 'sell', 39095.7875, 39778.4951, 'closed', now() - interval '97 days', now() - interval '3 days'),
  (v_youssef_id, 'GBPUSD', 'sell', 1.260426, 1.23791, 'closed', now() - interval '50 days', now() - interval '1 days'),
  (v_youssef_id, 'USDJPY', 'buy', 155.502656, 159.762101, 'closed', now() - interval '65 days', now() - interval '3 days'),
  (v_youssef_id, 'XRPUSDT', 'buy', 0.616908, 0.627943, 'closed', now() - interval '67 days', now() - interval '1 days'),
  (v_youssef_id, 'USDJPY', 'sell', 155.759548, 151.509592, 'closed', now() - interval '74 days', now() - interval '2 days'),
  (v_youssef_id, 'BTCUSDT', 'sell', 63179.1412, 60489.3005, 'closed', now() - interval '76 days', now() - interval '2 days'),
  (v_youssef_id, 'USDJPY', 'buy', 156.761531, 151.464892, 'closed', now() - interval '122 days', now() - interval '2 days'),
  (v_youssef_id, 'XAUUSD', 'sell', 4293.1438, 4180.9502, 'closed', now() - interval '34 days', now() - interval '3 days'),
  (v_youssef_id, 'EURUSD', 'sell', 1.09561, 1.065552, 'closed', now() - interval '49 days', now() - interval '3 days'),
  (v_youssef_id, 'XAUUSD', 'sell', 4308.6769, 4172.0555, 'closed', now() - interval '52 days', now() - interval '1 days'),
  (v_youssef_id, 'ETHUSDT', 'sell', 3377.6718, 3459.9404, 'closed', now() - interval '24 days', now() - interval '3 days'),
  (v_youssef_id, 'GBPUSD', 'sell', 1.276889, 1.233384, 'closed', now() - interval '128 days', now() - interval '3 days'),
  (v_youssef_id, 'BNBUSDT', 'sell', 565.236673, 543.670867, 'closed', now() - interval '99 days', now() - interval '2 days'),
  (v_youssef_id, 'SOLUSDT', 'sell', 144.178023, 148.277775, 'closed', now() - interval '16 days', now() - interval '1 days'),
  (v_youssef_id, 'USDJPY', 'buy', 157.886553, 162.206524, 'closed', now() - interval '47 days', now() - interval '3 days'),
  (v_youssef_id, 'GBPUSD', 'buy', 1.261789, 1.225385, 'closed', now() - interval '67 days', now() - interval '3 days'),
  (v_youssef_id, 'ETHUSDT', 'buy', 3431.2729, 3310.6968, 'closed', now() - interval '135 days', now() - interval '1 days'),
  (v_youssef_id, 'XAUUSD', 'buy', 4306.2104, 4398.6506, 'closed', now() - interval '45 days', now() - interval '3 days'),
  (v_youssef_id, 'USDJPY', 'sell', 157.992461, 162.658906, 'closed', now() - interval '50 days', now() - interval '2 days'),
  (v_youssef_id, 'BTCUSDT', 'sell', 63382.6169, 61331.0883, 'closed', now() - interval '50 days', now() - interval '1 days'),
  (v_youssef_id, 'ETHUSDT', 'buy', 3428.9062, 3516.4175, 'closed', now() - interval '140 days', now() - interval '1 days'),
  (v_youssef_id, 'USDJPY', 'buy', 156.278177, 161.936945, 'closed', now() - interval '131 days', now() - interval '1 days'),
  (v_youssef_id, 'EURUSD', 'sell', 1.094131, 1.06438, 'closed', now() - interval '68 days', now() - interval '1 days'),
  (v_youssef_id, 'XRPUSDT', 'buy', 0.616206, 0.635611, 'closed', now() - interval '145 days', now() - interval '2 days'),
  (v_youssef_id, 'BNBUSDT', 'buy', 575.697507, 599.1067, 'closed', now() - interval '71 days', now() - interval '2 days'),
  (v_youssef_id, 'XRPUSDT', 'buy', 0.622191, 0.632506, 'closed', now() - interval '44 days', now() - interval '2 days'),
  (v_youssef_id, 'EURUSD', 'sell', 1.085971, 1.107922, 'closed', now() - interval '148 days', now() - interval '2 days'),
  (v_youssef_id, 'XAUUSD', 'sell', 4263.8253, 4090.9074, 'closed', now() - interval '140 days', now() - interval '3 days'),
  (v_youssef_id, 'BTCUSDT', 'buy', 62491.1499, 64458.9482, 'closed', now() - interval '22 days', now() - interval '3 days'),
  (v_youssef_id, 'US30', 'buy', 39185.2737, 40863.2264, 'closed', now() - interval '49 days', now() - interval '1 days'),
  (v_youssef_id, 'USDJPY', 'sell', 155.664171, 151.874063, 'closed', now() - interval '142 days', now() - interval '2 days'),
  (v_youssef_id, 'US30', 'sell', 39173.4282, 40156.4307, 'closed', now() - interval '96 days', now() - interval '3 days'),
  (v_youssef_id, 'GBPUSD', 'sell', 1.266311, 1.238896, 'closed', now() - interval '132 days', now() - interval '1 days'),
  (v_youssef_id, 'USDJPY', 'sell', 156.462073, 161.520351, 'closed', now() - interval '117 days', now() - interval '3 days'),
  (v_youssef_id, 'US30', 'sell', 38933.375, 37263.0404, 'closed', now() - interval '105 days', now() - interval '3 days'),
  (v_youssef_id, 'SOLUSDT', 'buy', 145.607613, 149.651133, 'closed', now() - interval '130 days', now() - interval '1 days'),
  (v_youssef_id, 'SOLUSDT', 'buy', 145.011834, 148.565745, 'closed', now() - interval '33 days', now() - interval '3 days'),
  (v_youssef_id, 'ETHUSDT', 'buy', 3423.4969, 3496.2832, 'closed', now() - interval '70 days', now() - interval '3 days'),
  (v_youssef_id, 'XAUUSD', 'buy', 4337.9958, 4260.5448, 'closed', now() - interval '140 days', now() - interval '1 days'),
  (v_youssef_id, 'USDJPY', 'sell', 155.745722, 159.161556, 'closed', now() - interval '57 days', now() - interval '2 days'),
  (v_youssef_id, 'XRPUSDT', 'sell', 0.616929, 0.592129, 'closed', now() - interval '54 days', now() - interval '1 days'),
  (v_youssef_id, 'ETHUSDT', 'buy', 3414.3491, 3538.3645, 'closed', now() - interval '68 days', now() - interval '1 days'),
  (v_youssef_id, 'GBPUSD', 'buy', 1.25782, 1.236387, 'closed', now() - interval '78 days', now() - interval '1 days'),
  (v_youssef_id, 'BNBUSDT', 'buy', 575.107886, 560.523375, 'closed', now() - interval '56 days', now() - interval '2 days'),
  (v_youssef_id, 'BNBUSDT', 'sell', 572.850144, 585.352116, 'closed', now() - interval '9 days', now() - interval '2 days'),
  (v_youssef_id, 'BNBUSDT', 'sell', 564.399355, 545.612662, 'closed', now() - interval '127 days', now() - interval '3 days'),
  (v_youssef_id, 'US30', 'sell', 38988.3322, 37704.7017, 'closed', now() - interval '142 days', now() - interval '2 days'),
  (v_youssef_id, 'SOLUSDT', 'sell', 143.711439, 138.870585, 'closed', now() - interval '139 days', now() - interval '3 days'),
  (v_youssef_id, 'ETHUSDT', 'buy', 3376.7032, 3449.7252, 'closed', now() - interval '93 days', now() - interval '3 days'),
  (v_youssef_id, 'ETHUSDT', 'buy', 3427.3048, 3531.4582, 'closed', now() - interval '149 days', now() - interval '3 days'),
  (v_youssef_id, 'US30', 'buy', 38953.4701, 40128.0816, 'closed', now() - interval '44 days', now() - interval '2 days'),
  (v_youssef_id, 'XAUUSD', 'buy', 4273.8456, 4195.2995, 'closed', now() - interval '60 days', now() - interval '2 days'),
  (v_youssef_id, 'EURUSD', 'sell', 1.085436, 1.118951, 'closed', now() - interval '101 days', now() - interval '3 days'),
  (v_youssef_id, 'ETHUSDT', 'buy', 3379.2256, 3514.2687, 'closed', now() - interval '122 days', now() - interval '1 days'),
  (v_youssef_id, 'XAUUSD', 'sell', 4329.9004, 4210.4935, 'closed', now() - interval '37 days', now() - interval '1 days');

  insert into public.signals (provider_id, symbol, side, entry_price, status, opened_at)
  values
  (v_youssef_id, 'XRPUSDT', 'buy', 0.625106, 'open', now() - interval '2 hours'),
  (v_youssef_id, 'XAUUSD', 'buy', 4325.4033, 'open', now() - interval '5 hours');
end $$;
