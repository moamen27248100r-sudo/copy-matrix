-- Store the symbol directly on trader_posts (not just via signal_id) so the
-- feed can show a live chart for the exact instrument even if the
-- referenced signal row is ever deleted (signal_id is ON DELETE SET NULL).
alter table public.trader_posts add column symbol text;

update public.trader_posts tp
set symbol = s.symbol
from public.signals s
where s.id = tp.signal_id and tp.symbol is null;

create or replace function public.generate_trader_posts()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider record;
  v_signal record;
  v_side_label text;
  v_symbol_ar text;
  v_pct numeric;
  v_template text;
  v_win_templates text[] := array[
    'أغلقت للتو صفقة %1$s على %2$s بربح %3$s%%.',
    'نتيجة جيدة اليوم: صفقة %1$s على %2$s أغلقت بربح %3$s%%.',
    'صفقة %1$s على %2$s حققت ربحًا بنسبة %3$s%% — الالتزام بالخطة يؤتي ثماره.',
    'أنهيت صفقة %1$s على %2$s بربح %3$s%%، والتحليل كان في محله هذه المرة.'
  ];
  v_loss_templates text[] := array[
    'أغلقت صفقة %1$s على %2$s بخسارة %3$s%% — السوق لا يعطي دائمًا نفس النتيجة.',
    'صفقة %1$s على %2$s لم تسر كما هو مخطط، وأُغلقت بخسارة %3$s%%.',
    'خسارة %3$s%% في صفقة %1$s على %2$s اليوم، وإدارة رأس المال هي ما يحمي الحساب في مثل هذه الأيام.',
    'أغلقت صفقة %1$s على %2$s بخسارة %3$s%%، وهذا جزء طبيعي من التداول.'
  ];
begin
  for v_provider in
    select p.id
    from public.providers p
    where exists (
      select 1 from public.signals s
      where s.provider_id = p.id and s.status = 'closed' and s.closed_at >= now() - interval '14 days'
    )
    order by random()
    limit 15
  loop
    select s.id, s.symbol, s.side, s.entry_price, s.exit_price
    into v_signal
    from public.signals s
    where s.provider_id = v_provider.id and s.status = 'closed' and s.exit_price is not null
    order by s.closed_at desc
    limit 1;

    if v_signal.id is null then
      continue;
    end if;

    v_side_label := case when v_signal.side = 'buy' then 'شراء' else 'بيع' end;
    v_symbol_ar := case v_signal.symbol
      when 'XAUUSD' then 'الذهب'
      when 'EURUSD' then 'اليورو مقابل الدولار'
      when 'GBPUSD' then 'الجنيه الإسترليني مقابل الدولار'
      when 'USDJPY' then 'الدولار مقابل الين الياباني'
      when 'BTCUSDT' then 'البيتكوين'
      when 'ETHUSDT' then 'الإيثيريوم'
      when 'SOLUSDT' then 'سولانا'
      when 'BNBUSDT' then 'البي إن بي'
      when 'XRPUSDT' then 'الريبل'
      when 'US30' then 'مؤشر داو جونز الصناعي'
      else v_signal.symbol
    end;

    v_pct := (v_signal.exit_price - v_signal.entry_price) / v_signal.entry_price * 100;
    if v_signal.side = 'sell' then
      v_pct := -v_pct;
    end if;

    v_template := case
      when v_pct > 0 then v_win_templates[1 + floor(random() * array_length(v_win_templates, 1))::int]
      else v_loss_templates[1 + floor(random() * array_length(v_loss_templates, 1))::int]
    end;

    insert into public.trader_posts (provider_id, signal_id, symbol, body)
    values (
      v_provider.id,
      v_signal.id,
      v_signal.symbol,
      format(v_template, v_side_label, v_symbol_ar, round(abs(v_pct), 2)::text)
    );
  end loop;

  delete from public.trader_posts
  where id not in (select id from public.trader_posts order by created_at desc limit 200);
end;
$$;
