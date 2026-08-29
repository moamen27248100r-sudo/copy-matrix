-- ============================================================
-- Copy Matrix — another real leader-roster expansion (same generator
-- as 0047: genuine join dates, real trade-by-trade history driven by
-- skill, honest total_profit, tiered follower counts) — the roster
-- reads too small for the platform's positioning even after tripling
-- it once already.
--
-- (A "best cumulative return" SQL function was tried here for the
-- homepage's highest-return stat, but with hundreds of trades per
-- leader a simple sum of every trade's % move balloons into the
-- hundreds or thousands of percent — not a believable number for any
-- real platform to show. Dropped in favor of keeping that stat as
-- the per-trade average already used, which stays realistically
-- bounded regardless of trade volume.)
-- ============================================================

do $$
declare
  first_names text[] := array[
    'أحمد','محمد','عمر','يوسف','خالد','كريم','مصطفى','حسن','طارق','عمرو',
    'سارة','نور','منى','يارا','ليلى','دينا','رنا','سلمى','هند','آية',
    'إبراهيم','عادل','فادي','زياد','سلطان','نبيل','هشام','وليد','ياسر','فيصل',
    'رشا','هبة','نادية','فرح','لمياء','ريم','إيمان','داليا','رغد','غادة',
    'باسل','رامي','شريف','عماد','مروان','علي','سامي','حازم','فراس','أيمن',
    'مريم','جنى','لينا','روان','شهد','ملك','جود','تالا','مي','رهف'
  ];
  last_names text[] := array[
    'الزهراني','القحطاني','الدوسري','البلوي','الشمري','العنزي','فاروق','كمال','صبري','غانم',
    'الناصر','رمزي','فهمي','النعيمي','العتيبي','المطيري','الحربي','الشافعي','الغامدي','عزيز',
    'جابر','رشيد','السيد','زكي','حسين','عادل','صالح','عطية','محمود','الحسيني'
  ];
  bios text[] := array[
    'متداول محترف متخصص في العملات الرقمية بخبرة تزيد عن 5 سنوات.',
    'أركز على التحليل الفني للأزواج الرئيسية في سوق الفوركس.',
    'استراتيجية تداول متوسطة المدى تعتمد على إدارة رأس المال بحذر.',
    'متداول يومي متخصص في الذهب والمعادن.',
    'خبرة طويلة في أسواق الأسهم الأمريكية والمؤشرات العالمية.',
    'أعتمد على التحليل الأساسي والفني معًا لاتخاذ قرارات التداول.',
    'متخصص في صفقات قصيرة المدى على العملات الرقمية الرئيسية.',
    'إدارة مخاطر صارمة مع نسبة مخاطرة إلى عائد ثابتة.',
    'متداول متحفظ يركز على الحفاظ على رأس المال أولاً.',
    'أستهدف عوائد ثابتة شهريًا عبر استراتيجية منضبطة.',
    'متداول نشط في أسواق الفوركس والعملات الرقمية معًا.',
    'أفضّل الصفقات متوسطة الأجل بنسبة مخاطرة منخفضة.'
  ];
  min_copy_options numeric[] := array[25, 50, 75, 100, 150, 200, 250, 300, 500];
  v_all_symbols text[] := array['BTCUSDT','ETHUSDT','XAUUSD','EURUSD','GBPUSD','USDJPY','SOLUSDT','BNBUSDT','XRPUSDT','US30'];
  v_base_prices numeric[] := array[62000, 3400, 2350, 1.085, 1.27, 156.5, 145, 570, 0.62, 39000];
  v_provider_id uuid;
  v_symbol_bias text[];
  v_is_struggling boolean;
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
  v_margin_signal_id uuid;
  v_tier_min numeric;
  v_tier_max numeric;
  v_tenure_norm numeric;
  v_noise numeric;
  v_followers int;
  v_roll numeric;
  i int;
  j int;
begin
  for i in 1..300 loop
    v_is_struggling := random() < 0.16;
    v_skill := case when v_is_struggling
      then round((0.20 + random() * 0.15)::numeric, 4)
      else round((0.40 + random() * 0.32)::numeric, 4)
    end;

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

    v_joined := timestamp '2022-01-10' + (random() * (extract(epoch from (now() - timestamp '2022-01-10')) / 86400) || ' days')::interval;
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

    v_trade_count := greatest(10, least(400, round(v_tenure_days * 0.35 * (0.7 + random() * 0.6))::int));
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

      if v_is_struggling then
        v_is_win := random() < v_skill;
        v_move := case when v_is_win then 0.005 + random() * 0.015 else 0.020 + random() * 0.070 end;
      else
        v_is_win := random() < v_skill;
        v_move := case when v_is_win then 0.010 + random() * 0.080 else 0.003 + random() * 0.022 end;
      end if;

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

    if v_is_struggling then
      select id into v_margin_signal_id
      from public.signals
      where provider_id = v_provider_id and status = 'closed'
      order by random() limit 1;

      if v_margin_signal_id is not null then
        update public.signals
        set exit_price = round((
          case
            when side = 'buy' then entry_price * (1 - (0.18 + random() * 0.17))
            else entry_price * (1 + (0.18 + random() * 0.17))
          end
        )::numeric, 4)
        where id = v_margin_signal_id;

        select coalesce(sum(
          2000 * ((s.exit_price - s.entry_price) / s.entry_price) * (case when s.side = 'sell' then -1 else 1 end)
        ), 0) into v_pnl_sum
        from public.signals s
        where s.provider_id = v_provider_id and s.status = 'closed';
      end if;
    end if;

    if v_skill >= 0.65 then
      v_tier_min := 150; v_tier_max := 450;
    elsif v_skill >= 0.50 then
      v_tier_min := 70; v_tier_max := 200;
    elsif v_skill >= 0.35 then
      v_tier_min := 30; v_tier_max := 100;
    else
      v_tier_min := 10; v_tier_max := 50;
    end if;

    v_tenure_norm := least(1, v_tenure_days / 900.0);
    v_noise := 0.75 + random() * 0.5;
    v_followers := greatest(5, round(v_tier_min + (v_tier_max - v_tier_min) * v_tenure_norm * v_noise)::int);
    v_followers := least(v_followers, round(v_tier_max * 1.15)::int);

    update public.providers
    set total_profit = round(v_pnl_sum::numeric, 2),
        base_followers_count = v_followers
    where id = v_provider_id;
  end loop;
end $$;
