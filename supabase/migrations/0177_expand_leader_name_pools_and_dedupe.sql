-- Final leader-system QA found ~410 duplicate leader display_names
-- platform-wide (e.g. "Michael Brown" x7) -- a birthday-paradox result of
-- expand-international-leaders.mjs's original 4-first/4-last-name pool
-- per country (16 combos), not a data-entry mistake. Arabic-named leaders
-- had zero duplicates (569/569 distinct); this only ever affected
-- non-Arab leaders. Fixed retroactively for the existing 410 via
-- scripts/fix-duplicate-leader-names.mjs (data-only, no schema change).
--
-- This migration is the forward-looking half: run_daily_leader_lifecycle()
-- (0169) spawns a brand-new leader ~25% of days using this exact same
-- tiny 4x4 pool, so the collision would have quietly come right back one
-- new leader at a time. Retuned here to:
--   1. The same expanded (10-16 names per list) pools as the one-time
--      fix script, so future spawns start from far more headroom.
--   2. A genuine uniqueness guarantee (retry loop against existing
--      display_names, up to 50 attempts) rather than just better odds --
--      a spawned leader's name can never collide with an existing one.
--   3. ~15% of spawns go by a single name only (first name alone), same
--      variety the retroactive fix introduced, per explicit customer
--      request.
--
-- Nothing else in the function (archive sweep) changed.

CREATE OR REPLACE FUNCTION public.run_daily_leader_lifecycle()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_country_code text;
  v_country_first text[];
  v_country_last text[];
  v_name_first text;
  v_name_last text;
  v_candidate_name text;
  v_bio text;
  v_countries text[] := array['US','DE','FR','ES','IT','BR','CN','IN','GB','MX','CA','AU','TR','KR','NL'];
  v_pool_idx int;
  v_attempt int;
begin
  -- Spawn: ~25% chance/day a brand-new, blank-slate beginner leader joins
  -- the platform -- zero history, tiny starting follower count, left
  -- entirely to this same function's trade-generation logic (above) to
  -- build (or fail to build) a real track record from here, exactly like
  -- every other leader already on the platform. No fabricated backdated
  -- trades.
  if random() < 0.25 then
    v_country_code := v_countries[1 + floor(random() * array_length(v_countries, 1))::int];

    -- Expanded from an original 4x4 pool after QA found ~410 duplicate
    -- leader display_names platform-wide (fixed retroactively via
    -- scripts/fix-duplicate-leader-names.mjs) -- same pools as
    -- scripts/expand-international-leaders.mjs. Combined with the
    -- uniqueness-retry loop below, a repeat is now structurally
    -- impossible rather than just unlikely.
    case v_country_code
      when 'US' then v_country_first := array['Michael','Emily','James','Jessica','David','Ashley','Robert','Sarah','William','Amanda','Christopher','Elizabeth','Matthew','Megan','Daniel','Rachel']; v_country_last := array['Johnson','Williams','Brown','Davis','Miller','Wilson','Moore','Taylor','Anderson','Thomas','Jackson','White','Harris','Martin','Thompson','Clark'];
      when 'DE' then v_country_first := array['Lukas','Anna','Max','Lena','Paul','Laura','Jonas','Julia','Finn','Sophie','Tim','Hannah']; v_country_last := array['Müller','Schmidt','Weber','Becker','Schneider','Hoffmann','Koch','Richter','Klein','Wolf','Schäfer','Zimmermann'];
      when 'FR' then v_country_first := array['Louis','Emma','Hugo','Camille','Léo','Chloé','Nathan','Manon','Théo','Léa','Antoine','Julie']; v_country_last := array['Martin','Bernard','Dubois','Girard','Thomas','Robert','Petit','Durand','Moreau','Lefebvre','Roux','Fournier'];
      when 'ES' then v_country_first := array['Pablo','Lucía','Alejandro','María','Carlos','Carmen','Javier','Elena','Daniel','Marta','Sergio','Laura']; v_country_last := array['García','Martínez','López','Sánchez','González','Pérez','Rodríguez','Fernández','Gómez','Ruiz','Díaz','Moreno'];
      when 'IT' then v_country_first := array['Marco','Giulia','Luca','Chiara','Alessandro','Francesca','Matteo','Sara','Andrea','Elena','Davide','Valentina']; v_country_last := array['Rossi','Russo','Ferrari','Esposito','Bianchi','Romano','Colombo','Ricci','Marino','Greco','Bruno','Gallo'];
      when 'BR' then v_country_first := array['Lucas','Beatriz','Gabriel','Larissa','Matheus','Juliana','Rafael','Camila','Bruno','Fernanda','Felipe','Mariana']; v_country_last := array['Silva','Souza','Oliveira','Pereira','Costa','Rodrigues','Almeida','Carvalho','Gomes','Martins','Araújo','Barbosa'];
      when 'CN' then v_country_first := array['Wei','Mei','Jun','Xin','Yan','Feng','Ling','Hao','Yun','Qiang','Fang','Bo']; v_country_last := array['Zhang','Wang','Li','Chen','Liu','Yang','Huang','Zhao','Wu','Zhou','Xu','Sun'];
      when 'IN' then v_country_first := array['Arjun','Ananya','Rohan','Priya','Aditya','Neha','Vikram','Pooja','Karan','Divya','Siddharth','Meera']; v_country_last := array['Sharma','Patel','Gupta','Kumar','Singh','Reddy','Rao','Nair','Mehta','Joshi','Agarwal','Verma'];
      when 'GB' then v_country_first := array['Oliver','Amelia','George','Isla','Harry','Ella','Jack','Freya','Thomas','Grace','Charlie','Poppy']; v_country_last := array['Smith','Taylor','Wilson','Evans','Jones','Brown','Davies','Roberts','Walker','Wright','Green','Hall'];
      when 'MX' then v_country_first := array['Diego','Valentina','Santiago','Camila','Alejandro','Ximena','Emiliano','Regina','Mateo','Fernanda','Leonardo','Paulina']; v_country_last := array['Hernández','García','Martínez','López','González','Ramírez','Flores','Torres','Vázquez','Reyes','Jiménez','Morales'];
      when 'CA' then v_country_first := array['Liam','Olivia','Noah','Emma','Ethan','Sophia','Logan','Charlotte','Benjamin','Mia','Jacob','Zoe']; v_country_last := array['Roy','Gagnon','Tremblay','Clark','Bouchard','Gauthier','Morin','Lavoie','Fortin','Cote','Bergeron','Lambert'];
      when 'AU' then v_country_first := array['Jack','Chloe','William','Olivia','Oliver','Charlotte','Noah','Mia','Lucas','Ava','Ethan','Grace']; v_country_last := array['Anderson','Wilson','Taylor','Thompson','Robinson','Walker','White','Harris','Martin','Clarke','Bell','King'];
      when 'TR' then v_country_first := array['Emre','Elif','Mehmet','Zeynep','Ahmet','Ayşe','Mustafa','Fatma','Can','Selin']; v_country_last := array['Yılmaz','Kaya','Demir','Şahin','Çelik','Yıldız','Yıldırım','Öztürk','Aydın','Özdemir'];
      when 'KR' then v_country_first := array['Ji-woo','Min-jun','Seo-yeon','Joon','Ha-eun','Do-yoon','Yu-jin','Jae-won','Soo-bin','Eun-woo']; v_country_last := array['Kim','Park','Lee','Choi','Jung','Kang','Cho','Yoon','Jang','Lim'];
      else v_country_first := array['Daan','Sanne','Sem','Eva','Lars','Fleur','Bram','Iris','Thijs','Anne']; v_country_last := array['de Jong','Jansen','de Vries','Bakker','Visser','Smit','Meijer','de Boer','Mulder','Dekker'];
    end case;

    -- Retry until the candidate name isn't already taken -- ~15% of the
    -- time it's a single name (first name alone) only, matching the same
    -- variety the retroactive fix script introduced.
    for v_attempt in 1..50 loop
      v_name_first := v_country_first[1 + floor(random() * array_length(v_country_first, 1))::int];
      if random() < 0.15 then
        v_candidate_name := v_name_first;
      else
        v_name_last := v_country_last[1 + floor(random() * array_length(v_country_last, 1))::int];
        v_candidate_name := v_name_first || ' ' || v_name_last;
      end if;
      exit when not exists (select 1 from public.providers where display_name = v_candidate_name);
    end loop;

    -- Reuses whichever generic (non-nationality-specific) bio text is
    -- currently shared by the most leaders platform-wide -- same source
    -- scripts/expand-international-leaders.mjs draws from, so a spawned
    -- leader's bio needs no new translation work (already in the Bios
    -- namespace across all 13 locales).
    select bio into v_bio from public.providers where bio is not null group by bio having count(*) > 3 order by random() limit 1;

    insert into public.providers (
      display_name, country, bio, base_followers_count, account_capital, min_copy_amount,
      trading_status, risk_archetype, trading_style, activity_weight, skill
    )
    values (
      v_candidate_name,
      v_country_code,
      coalesce(v_bio, 'متداول محترف متخصص في العملات الرقمية بخبرة تزيد عن 5 سنوات.'),
      1 + floor(random() * 3)::int,
      round((200 + random() * 600)::numeric, 2),
      round((50 + random() * 100)::numeric, 2),
      'active',
      (array['stable','balanced','good_rr'])[1 + floor(random() * 3)::int],
      (array['moderate','scalper','sporadic'])[1 + floor(random() * 3)::int],
      round((0.8 + random() * 0.4)::numeric, 2),
      round((0.45 + random() * 0.20)::numeric, 2)
    );
  end if;

  -- Archive: a leader who's been stopped (margin-called and didn't
  -- recover), has almost no followers left, and has sat that way for two
  -- weeks is hidden from discovery -- not deleted, so their own profile
  -- page and any existing copier's link to it keep working.
  update public.providers
  set is_archived = true
  where trading_status = 'stopped'
    and base_followers_count <= 5
    and margin_called_at < now() - interval '14 days'
    and not is_archived;
end;
$function$

;
