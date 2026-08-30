-- ============================================================
-- Copy Matrix — every leader so far trades inside the same
-- moderate move-size bands (regular: 0.3%-9% per trade, struggling:
-- similar but loss-skewed), so the platform's real "best return"
-- stat never climbs much past single digits no matter how many
-- leaders exist. Real copy-trading platforms also have a genuine
-- high-risk/high-reward archetype: leaders who take much bigger
-- swings per trade — bigger wins, but bigger losses too — and
-- whose successful members post real double-digit average returns.
--
-- This adds ~70 such leaders with their own wide move-size bands.
-- Same honest mechanics as every other batch: real trade-by-trade
-- history, real total_profit, real follower tiering — some of these
-- will genuinely be net losers (high risk cuts both ways), which is
-- the point.
-- ============================================================

do $$
declare
  first_names text[] := array[
    'أحمد','محمد','عمر','يوسف','خالد','كريم','مصطفى','حسن','طارق','عمرو',
    'سارة','نور','منى','يارا','ليلى','دينا','رنا','سلمى','هند','آية',
    'إبراهيم','عادل','فادي','زياد','سلطان','نبيل','هشام','وليد','ياسر','فيصل',
    'رشا','هبة','نادية','فرح','لمياء','ريم','إيمان','داليا','رغد','غادة'
  ];
  last_names text[] := array[
    'الزهراني','القحطاني','الدوسري','البلوي','الشمري','العنزي','فاروق','كمال','صبري','غانم',
    'الناصر','رمزي','فهمي','النعيمي','العتيبي','المطيري','الحربي','الشافعي','الغامدي','عزيز'
  ];
  bios text[] := array[
    'متداول عالي المخاطرة يستهدف عوائد كبيرة عبر صفقات قصيرة الأجل شديدة التقلب.',
    'أستخدم رافعة مالية مرتفعة على العملات الرقمية بحثًا عن حركات سعرية كبيرة.',
    'استراتيجية عدوانية على الذهب والمؤشرات مع تقلبات واسعة في العائد الشهري.',
    'أستهدف الاختراقات السعرية القوية، والمخاطرة عندي أعلى من المتوسط بوضوح.',
    'متداول مضاربة قصيرة الأجل على العملات الرقمية الأكثر تقلبًا في السوق.'
  ];
  min_copy_options numeric[] := array[100, 150, 200, 250, 300, 500];
  v_all_symbols text[] := array['BTCUSDT','ETHUSDT','XAUUSD','EURUSD','GBPUSD','USDJPY','SOLUSDT','BNBUSDT','XRPUSDT','US30'];
  v_base_prices numeric[] := array[62000, 3400, 2350, 1.085, 1.27, 156.5, 145, 570, 0.62, 39000];
  v_provider_id uuid;
  v_symbol_bias text[];
  v_skill numeric;
  v_joined timestamptz;
  v_tenure_days numeric;
  v_trade_count int;
  v_pnl_sum numeric;
  v_symbol text;
  v_symbol_idx int;
  v_side text;
  v_entry numeric;
  v_move numeric;
  v_is_win boolean;
  v_opened timestamptz;
  v_closed timestamptz;
  v_trade_pnl numeric;
  v_followers int;
  v_roll numeric;
  i int;
  j int;
begin
  for i in 1..70 loop
    -- Win probability spread wide on purpose: some of these leaders
    -- are genuinely skilled aggressive traders, others are just
    -- reckless — same real mix a "high risk" filter would surface
    -- on any real platform.
    v_skill := round((0.38 + random() * 0.34)::numeric, 4);

    v_symbol_bias := array[
      v_all_symbols[1 + floor(random() * 10)::int],
      v_all_symbols[1 + floor(random() * 10)::int],
      v_all_symbols[1 + floor(random() * 10)::int],
      v_all_symbols[1 + floor(random() * 10)::int],
      v_all_symbols[1 + floor(random() * 10)::int],
      v_all_symbols[1 + floor(random() * 10)::int],
      v_all_symbols[1 + floor(random() * 10)::int],
      v_all_symbols[1 + floor(random() * 10)::int],
      v_all_symbols[1 + floor(random() * 10)::int],
      v_all_symbols[1 + floor(random() * 10)::int]
    ];

    v_joined := timestamp '2022-06-01' + (random() * (extract(epoch from (now() - timestamp '2022-06-01')) / 86400) || ' days')::interval;
    v_tenure_days := greatest(1, extract(epoch from (now() - v_joined)) / 86400);

    insert into public.providers (display_name, bio, symbol_bias, skill, min_copy_amount, created_at, base_followers_count)
    values (
      first_names[1 + floor(random() * array_length(first_names, 1))::int] || ' ' ||
        last_names[1 + floor(random() * array_length(last_names, 1))::int],
      bios[1 + floor(random() * array_length(bios, 1))::int],
      v_symbol_bias,
      v_skill,
      min_copy_options[1 + floor(random() * array_length(min_copy_options, 1))::int],
      v_joined,
      1
    )
    returning id into v_provider_id;

    v_trade_count := greatest(15, least(150, round(v_tenure_days * 0.12 * (0.7 + random() * 0.6))::int));
    v_pnl_sum := 0;

    for j in 1..v_trade_count loop
      v_roll := random();
      v_symbol := case
        when v_roll < 0.40 then v_symbol_bias[1]
        when v_roll < 0.68 then v_symbol_bias[2]
        when v_roll < 0.84 then v_symbol_bias[3]
        when v_roll < 0.96 then v_symbol_bias[4]
        else v_symbol_bias[5 + floor(random() * 6)::int]
      end;
      v_symbol_idx := array_position(v_all_symbols, v_symbol);
      v_side := case when random() < 0.5 then 'buy' else 'sell' end;
      v_entry := round((v_base_prices[v_symbol_idx] * (1 + (random() - 0.5) * 0.02))::numeric, 4);

      v_opened := v_joined + ((random() * v_tenure_days) || ' days')::interval;
      v_closed := least(v_opened + (random() * 3 + 0.1 || ' days')::interval, now());

      -- Wide, high-risk move bands: big wins, big losses.
      v_is_win := random() < v_skill;
      v_move := case when v_is_win then 0.05 + random() * 0.30 else 0.03 + random() * 0.22 end;

      insert into public.signals (provider_id, symbol, side, entry_price, exit_price, status, opened_at, closed_at)
      values (
        v_provider_id,
        v_symbol,
        v_side,
        v_entry,
        round((
          case
            when (v_side = 'buy' and v_is_win) or (v_side = 'sell' and not v_is_win)
              then v_entry * (1 + v_move)
            else v_entry * (1 - v_move)
          end
        )::numeric, 4),
        'closed',
        v_opened,
        v_closed
      );

      v_trade_pnl := 2000 * v_move * (case when v_is_win then 1 else -1 end);
      v_pnl_sum := v_pnl_sum + v_trade_pnl;
    end loop;

    -- Followers: high-risk/high-reward traders draw real attention
    -- when they're winning, so give the skilled end of this cohort a
    -- wider, higher ceiling than the "good" tier used elsewhere.
    v_followers := greatest(10, round((40 + (v_skill - 0.38) / 0.34 * 560) * (0.75 + random() * 0.5))::int);
    v_followers := least(v_followers, 700);

    update public.providers
    set total_profit = round(v_pnl_sum::numeric, 2),
        base_followers_count = v_followers
    where id = v_provider_id;
  end loop;
end $$;
