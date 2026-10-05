-- Disk headroom for the rebuilt simulated leaders (0234).
--
-- * price_history keeps 7 days instead of 30: nothing in the app reads it
--   except the live engine, whose look-back windows are at most 24 hours and
--   whose symbol volatility now uses the last 7 days.
-- * The old signal backup tables were exported to local JSON files
--   (copy-matrix-backups/2026-10-04-old-bak-tables) and are dropped here.

create or replace function public.cleanup_old_price_history()
returns void language sql security definer set search_path = public as $$
  delete from public.price_history where ts < now() - interval '7 days';
$$;

create or replace function public.refresh_sim_symbol_volatility()
returns void language sql security definer set search_path = public as $$
  update public.sim_symbols s set sigma_h = v.sd
  from (
    select symbol, stddev_samp(r) sd from (
      select symbol, ln(price / lag(price) over (partition by symbol order by h)) r
      from (
        select symbol, date_trunc('hour', ts) h, (array_agg(price order by ts desc))[1] price
        from public.price_history where ts > now() - interval '7 days'
        group by 1, 2
      ) hourly
    ) x where r is not null and r <> 0 group by symbol having count(*) > 48
  ) v where v.symbol = s.symbol;
$$;

drop table if exists public._bak_20261001_signals;
drop table if exists public._bak_20261001b_signals;
drop table if exists public._bak_20261001c_signals_no_lot;

select public.cleanup_old_price_history();
