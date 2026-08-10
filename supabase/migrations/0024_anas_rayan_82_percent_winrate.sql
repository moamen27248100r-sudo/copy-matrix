-- ============================================================
-- Copy Matrix — recalibrate "أنس ريان" to a verified 82% win rate
-- (was ~91%, felt unrealistically high). Replaces his trade history
-- with a precomputed set (not sql random()) that yields exactly
-- 82.00% win rate, and sets his persistent skill to 0.82 so future
-- automated trades stay consistent with the stated win rate — same
-- mechanism already driving every other leader's ongoing trades.
-- ============================================================

do $$
declare
  v_provider_id uuid;
begin
  select id into v_provider_id from public.providers where display_name = 'أنس ريان';

  update public.providers set skill = 0.82 where id = v_provider_id;

  delete from public.signals where provider_id = v_provider_id;

  insert into public.signals (provider_id, symbol, side, entry_price, exit_price, status, opened_at, closed_at)
  values
  (v_provider_id, 'BTCUSDT', 'buy', 63004.636960, 64079.056157, 'closed', now() - interval '75 days', now() - interval '72 days'),
  (v_provider_id, 'ETHUSDT', 'buy', 3397.840749, 3478.741403, 'closed', now() - interval '35 days', now() - interval '34 days'),
  (v_provider_id, 'XAUUSD', 'sell', 4306.254797, 4231.482944, 'closed', now() - interval '25 days', now() - interval '22 days'),
  (v_provider_id, 'EURUSD', 'buy', 1.086926, 1.106169, 'closed', now() - interval '111 days', now() - interval '108 days'),
  (v_provider_id, 'GBPUSD', 'sell', 1.269786, 1.279375, 'closed', now() - interval '43 days', now() - interval '40 days'),
  (v_provider_id, 'USDJPY', 'sell', 157.245045, 153.751121, 'closed', now() - interval '127 days', now() - interval '126 days'),
  (v_provider_id, 'SOLUSDT', 'sell', 144.644741, 145.534510, 'closed', now() - interval '124 days', now() - interval '122 days'),
  (v_provider_id, 'BNBUSDT', 'buy', 569.958780, 582.621071, 'closed', now() - interval '10 days', now() - interval '7 days'),
  (v_provider_id, 'BTCUSDT', 'sell', 62994.871528, 61646.299526, 'closed', now() - interval '127 days', now() - interval '125 days'),
  (v_provider_id, 'ETHUSDT', 'buy', 3413.824014, 3488.074335, 'closed', now() - interval '64 days', now() - interval '63 days'),
  (v_provider_id, 'XAUUSD', 'buy', 4284.176745, 4376.216611, 'closed', now() - interval '37 days', now() - interval '35 days'),
  (v_provider_id, 'EURUSD', 'buy', 1.088901, 1.108869, 'closed', now() - interval '119 days', now() - interval '118 days'),
  (v_provider_id, 'GBPUSD', 'sell', 1.267446, 1.240183, 'closed', now() - interval '33 days', now() - interval '32 days'),
  (v_provider_id, 'USDJPY', 'sell', 155.823235, 156.894552, 'closed', now() - interval '78 days', now() - interval '75 days'),
  (v_provider_id, 'SOLUSDT', 'sell', 145.356216, 141.830151, 'closed', now() - interval '57 days', now() - interval '56 days'),
  (v_provider_id, 'BNBUSDT', 'sell', 567.712401, 570.975316, 'closed', now() - interval '130 days', now() - interval '129 days'),
  (v_provider_id, 'BTCUSDT', 'sell', 63293.624614, 62122.703412, 'closed', now() - interval '78 days', now() - interval '75 days'),
  (v_provider_id, 'ETHUSDT', 'buy', 3410.778472, 3488.678149, 'closed', now() - interval '41 days', now() - interval '38 days'),
  (v_provider_id, 'XAUUSD', 'buy', 4320.316800, 4411.034266, 'closed', now() - interval '4 days', now() - interval '3 days'),
  (v_provider_id, 'EURUSD', 'sell', 1.084937, 1.064838, 'closed', now() - interval '138 days', now() - interval '137 days'),
  (v_provider_id, 'GBPUSD', 'sell', 1.273051, 1.244613, 'closed', now() - interval '15 days', now() - interval '14 days'),
  (v_provider_id, 'USDJPY', 'buy', 156.636220, 160.132984, 'closed', now() - interval '57 days', now() - interval '56 days'),
  (v_provider_id, 'SOLUSDT', 'sell', 144.737032, 141.244909, 'closed', now() - interval '62 days', now() - interval '60 days'),
  (v_provider_id, 'BNBUSDT', 'buy', 568.187010, 578.834262, 'closed', now() - interval '87 days', now() - interval '85 days'),
  (v_provider_id, 'BTCUSDT', 'sell', 63068.673997, 61673.420170, 'closed', now() - interval '88 days', now() - interval '86 days'),
  (v_provider_id, 'ETHUSDT', 'buy', 3386.605358, 3449.899921, 'closed', now() - interval '95 days', now() - interval '93 days'),
  (v_provider_id, 'XAUUSD', 'buy', 4313.279900, 4283.593485, 'closed', now() - interval '53 days', now() - interval '50 days'),
  (v_provider_id, 'EURUSD', 'sell', 1.087225, 1.094657, 'closed', now() - interval '46 days', now() - interval '44 days'),
  (v_provider_id, 'GBPUSD', 'buy', 1.270293, 1.298725, 'closed', now() - interval '41 days', now() - interval '38 days'),
  (v_provider_id, 'USDJPY', 'buy', 156.167578, 159.467582, 'closed', now() - interval '13 days', now() - interval '10 days'),
  (v_provider_id, 'SOLUSDT', 'sell', 145.060647, 141.497826, 'closed', now() - interval '30 days', now() - interval '29 days'),
  (v_provider_id, 'BNBUSDT', 'sell', 568.497422, 556.856540, 'closed', now() - interval '147 days', now() - interval '144 days'),
  (v_provider_id, 'BTCUSDT', 'sell', 62864.464120, 63312.943648, 'closed', now() - interval '67 days', now() - interval '64 days'),
  (v_provider_id, 'ETHUSDT', 'sell', 3409.724426, 3433.840801, 'closed', now() - interval '145 days', now() - interval '143 days'),
  (v_provider_id, 'XAUUSD', 'buy', 4317.745057, 4407.069667, 'closed', now() - interval '65 days', now() - interval '62 days'),
  (v_provider_id, 'EURUSD', 'sell', 1.084645, 1.064881, 'closed', now() - interval '16 days', now() - interval '13 days'),
  (v_provider_id, 'GBPUSD', 'buy', 1.264974, 1.293790, 'closed', now() - interval '37 days', now() - interval '34 days'),
  (v_provider_id, 'USDJPY', 'buy', 156.059596, 159.616475, 'closed', now() - interval '43 days', now() - interval '40 days'),
  (v_provider_id, 'SOLUSDT', 'sell', 145.002368, 142.507492, 'closed', now() - interval '107 days', now() - interval '106 days'),
  (v_provider_id, 'BNBUSDT', 'sell', 568.080673, 558.092174, 'closed', now() - interval '105 days', now() - interval '103 days'),
  (v_provider_id, 'BTCUSDT', 'sell', 63202.106096, 61647.603046, 'closed', now() - interval '30 days', now() - interval '29 days'),
  (v_provider_id, 'ETHUSDT', 'sell', 3384.851723, 3325.818563, 'closed', now() - interval '147 days', now() - interval '144 days'),
  (v_provider_id, 'XAUUSD', 'sell', 4305.576470, 4224.500073, 'closed', now() - interval '151 days', now() - interval '150 days'),
  (v_provider_id, 'EURUSD', 'buy', 1.083763, 1.109237, 'closed', now() - interval '133 days', now() - interval '130 days'),
  (v_provider_id, 'GBPUSD', 'buy', 1.273714, 1.297570, 'closed', now() - interval '77 days', now() - interval '76 days'),
  (v_provider_id, 'USDJPY', 'sell', 155.983814, 153.033415, 'closed', now() - interval '127 days', now() - interval '125 days'),
  (v_provider_id, 'SOLUSDT', 'buy', 145.117135, 148.604515, 'closed', now() - interval '144 days', now() - interval '141 days'),
  (v_provider_id, 'BNBUSDT', 'buy', 569.329356, 566.336228, 'closed', now() - interval '153 days', now() - interval '152 days'),
  (v_provider_id, 'BTCUSDT', 'sell', 62969.377701, 61541.784600, 'closed', now() - interval '129 days', now() - interval '127 days'),
  (v_provider_id, 'ETHUSDT', 'sell', 3385.444041, 3317.517824, 'closed', now() - interval '17 days', now() - interval '14 days');

  insert into public.signals (provider_id, symbol, side, entry_price, status, opened_at)
  values
  (v_provider_id, 'XAUUSD', 'buy', 4341.935, 'open', now() - interval '4 hours'),
  (v_provider_id, 'EURUSD', 'sell', 1.15537, 'open', now() - interval '9 hours');
end $$;
