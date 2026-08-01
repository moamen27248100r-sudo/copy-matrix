-- ============================================================
-- Copy Matrix — allow platform-curated leaders (no login account
-- of their own), and seed 80 of them with a full track record.
-- ============================================================

alter table public.providers alter column user_id drop not null;
alter table public.providers add column display_name text;
alter table public.providers add column base_followers_count integer not null default 0;
alter table public.providers add constraint providers_identity_check
  check (user_id is not null or display_name is not null);

create or replace view public.provider_cards as
select
  p.id as provider_id,
  p.bio,
  coalesce(pr.display_name, p.display_name) as display_name,
  coalesce(pf.followers_count, 0) + p.base_followers_count as followers_count,
  coalesce(perf.open_signals, 0) as open_signals,
  coalesce(perf.closed_signals, 0) as closed_signals,
  perf.win_rate_pct,
  perf.avg_return_pct
from public.providers p
left join public.profiles pr on pr.id = p.user_id
left join public.provider_performance perf on perf.provider_id = p.id
left join public.provider_followers pf on pf.provider_id = p.id;

do $$
declare
  first_names text[] := array['Ahmed','Mohamed','Omar','Youssef','Khaled','Karim','Mostafa','Hassan','Tarek','Amr','Sara','Nour','Mona','Yara','Laila','Dina','Rana','Salma','Hind','Aya'];
  last_names text[] := array['Nasser','El-Sayed','Fahmy','Adel','Farouk','Zaki','Hussein','Mahmoud','Rashid','Attia'];
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
  i int;
  j int;
begin
  for i in 0..79 loop
    v_skill := random();
    v_win_prob := 0.35 + v_skill * 0.45;

    insert into public.providers (display_name, bio, base_followers_count)
    values (
      first_names[1 + (i % 20)] || ' ' || last_names[1 + (i % 10)],
      bios[1 + (i % 10)],
      (random() * 4800 + 200)::int
    )
    returning id into v_provider_id;

    v_num_signals := 15 + floor(random() * 30)::int;

    for j in 1..v_num_signals loop
      v_symbol_idx := 1 + floor(random() * 10)::int;
      v_side := case when random() < 0.5 then 'buy' else 'sell' end;
      v_entry := base_prices[v_symbol_idx] * (1 + (random() - 0.5) * 0.02);
      v_is_open := random() < 0.15;

      if v_is_open then
        insert into public.signals (provider_id, symbol, side, entry_price, status, opened_at)
        values (
          v_provider_id, symbols[v_symbol_idx], v_side, v_entry, 'open',
          now() - (random() * 20 || ' days')::interval
        );
      else
        v_is_win := random() < v_win_prob;
        v_move := 0.005 + random() * 0.03;

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
          now() - (random() * 120 + 20 || ' days')::interval,
          now() - (random() * 20 || ' days')::interval
        );
      end if;
    end loop;
  end loop;
end $$;
