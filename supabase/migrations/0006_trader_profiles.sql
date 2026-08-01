-- ============================================================
-- Copy Matrix — join date / profit / withdrawals on providers,
-- richer provider_cards view, and Arabic-named leaders with
-- signals spread realistically across the last 6 months.
-- ============================================================

alter table public.providers add column total_profit numeric not null default 0;
alter table public.providers add column total_withdrawals numeric not null default 0;

create or replace view public.provider_cards as
select
  p.id as provider_id,
  p.bio,
  coalesce(pr.display_name, p.display_name) as display_name,
  coalesce(pf.followers_count, 0) + p.base_followers_count as followers_count,
  coalesce(perf.open_signals, 0) as open_signals,
  coalesce(perf.closed_signals, 0) as closed_signals,
  perf.win_rate_pct,
  perf.avg_return_pct,
  p.created_at as joined_at,
  p.total_profit,
  p.total_withdrawals
from public.providers p
left join public.profiles pr on pr.id = p.user_id
left join public.provider_performance perf on perf.provider_id = p.id
left join public.provider_followers pf on pf.provider_id = p.id;

delete from public.signals where provider_id in (select id from public.providers where user_id is null);
delete from public.providers where user_id is null;

do $$
declare
  first_names text[] := array['أحمد','محمد','عمر','يوسف','خالد','كريم','مصطفى','حسن','طارق','عمرو','علي','إبراهيم','شريف','وليد','حازم','زياد','نبيل','رامي','فادي','باسل','عماد','سامي','مروان','ياسر','هشام','عادل','فيصل','سلطان','ماجد','نايف','سارة','نور','منى','يارا','ليلى','دينا','رنا','سلمى','هند','آية','إيمان','هبة','رشا','نادية','فرح','ريم','داليا','منال','رغد','لمياء'];
  last_names text[] := array['الناصر','السيد','فهمي','عادل','فاروق','زكي','حسين','محمود','رشيد','عطية','كمال','الشافعي','جابر','عزيز','يونس','صالح','غانم','رمزي','صبري','العتيبي','القحطاني','الدوسري','المطيري','الشمري','الزهراني','العنزي','البلوي','الحربي','الغامدي','النعيمي'];
  bios text[] := array[
    'متداول محترف متخصص في العملات الرقمية بخبرة تزيد عن 5 سنوات.',
    'أركز على التحليل الفني للأزواج الرئيسية في سوق الفوركس.',
    'استراتيجية تداول متوسطة المدى تعتمد على إدارة رأس المال بحذر.',
    'متداول يومي متخصص في الذهب والمعادن.',
    'خبرة طويلة في أسواق الأسهم الأمريكية.',
    'أعتمد على التحليل الأساسي والفني معًا لاتخاذ قرارات التداول.',
    'متخصص في صفقات قصيرة المدى على العملات الرقمية الرئيسية.',
    'إدارة مخاطر صارمة مع نسبة مخاطرة إلى عائد ثابتة.',
    'متداول متحفظ يركز على الحفاظ على رأس المال أولاً.',
    'أستهدف عوائد ثابتة شهريًا عبر استراتيجية منضبطة.'
  ];
  symbols text[] := array['BTCUSDT','ETHUSDT','XAUUSD','EURUSD','GBPUSD','USDJPY','SOLUSDT','BNBUSDT','XRPUSDT','US30'];
  base_prices numeric[] := array[62000, 3400, 2350, 1.085, 1.27, 156.5, 145, 570, 0.62, 39000];
  v_provider_id uuid;
  v_skill numeric;
  v_win_prob numeric;
  v_num_signals int;
  v_symbol_idx int;
  v_entry numeric;
  v_move numeric;
  v_side text;
  v_is_open boolean;
  v_is_win boolean;
  v_count int;
  v_joined timestamptz;
  v_bucket numeric;
  v_days_back numeric;
  v_opened timestamptz;
  v_closed timestamptz;
  v_profit numeric;
  i int;
  j int;
begin
  v_count := 95 + floor(random() * 46)::int;

  for i in 1..v_count loop
    v_skill := random();
    v_win_prob := 0.35 + v_skill * 0.45;
    v_joined := now() - ((200 + random() * 700) || ' days')::interval;
    v_profit := round((v_skill * 180000 + random() * 40000)::numeric, 2);

    insert into public.providers (display_name, bio, base_followers_count, created_at, total_profit, total_withdrawals)
    values (
      first_names[1 + floor(random() * array_length(first_names,1))::int] || ' ' || last_names[1 + floor(random() * array_length(last_names,1))::int],
      bios[1 + floor(random() * array_length(bios,1))::int],
      (random() * 4800 + 200)::int,
      v_joined,
      v_profit,
      round((v_profit * random() * 0.6)::numeric, 2)
    )
    returning id into v_provider_id;

    v_num_signals := 20 + floor(random() * 40)::int;

    for j in 1..v_num_signals loop
      v_symbol_idx := 1 + floor(random() * 10)::int;
      v_side := case when random() < 0.5 then 'buy' else 'sell' end;
      v_entry := base_prices[v_symbol_idx] * (1 + (random() - 0.5) * 0.02);

      v_bucket := random();
      v_days_back := case
        when v_bucket < 0.15 then random() * 1
        when v_bucket < 0.4 then random() * 7
        when v_bucket < 0.65 then random() * 30
        when v_bucket < 0.85 then random() * 90
        else random() * 180
      end;
      v_opened := now() - (v_days_back || ' days')::interval;
      v_is_open := random() < 0.1;

      if v_is_open then
        insert into public.signals (provider_id, symbol, side, entry_price, status, opened_at)
        values (v_provider_id, symbols[v_symbol_idx], v_side, v_entry, 'open', v_opened);
      else
        v_is_win := random() < v_win_prob;
        v_move := 0.005 + random() * 0.03;
        v_closed := least(v_opened + (random() * 3 + 0.1 || ' days')::interval, now());

        insert into public.signals (provider_id, symbol, side, entry_price, exit_price, status, opened_at, closed_at)
        values (
          v_provider_id,
          symbols[v_symbol_idx],
          v_side,
          v_entry,
          case
            when (v_side = 'buy' and v_is_win) or (v_side = 'sell' and not v_is_win)
              then v_entry * (1 + v_move)
            else v_entry * (1 - v_move)
          end,
          'closed',
          v_opened,
          v_closed
        );
      end if;
    end loop;
  end loop;
end $$;
