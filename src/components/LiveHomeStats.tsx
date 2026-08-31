"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

type RawStats = {
  total_followers: number | string;
  total_trades: number | string;
  total_volume: number | string;
  best_daily_return: number | string | null;
  weighted_win_rate: number | string | null;
};

type Stats = {
  totalTraders: number;
  totalCopiers: number;
  totalTrades: number;
  totalVolume: number;
  bestReturn: number | null;
  avgWinRate: number | null;
};

// متداول نشط has no independent real count of its own (see page.tsx) — it's
// derived as a share of the real total_followers count, same as the
// server-rendered first paint, so it re-derives from every live poll too.
const ACTIVE_TRADER_RATIO = 0.12;
const POLL_MS = 20000;

function deriveStats(raw: RawStats): Stats {
  const totalCopiers = Number(raw.total_followers ?? 0);
  return {
    totalTraders: Math.round(totalCopiers * ACTIVE_TRADER_RATIO),
    totalCopiers,
    totalTrades: Number(raw.total_trades ?? 0),
    totalVolume: Number(raw.total_volume ?? 0),
    bestReturn: raw.best_daily_return != null ? Number(raw.best_daily_return) : null,
    avgWinRate: raw.weighted_win_rate != null ? Math.round(Number(raw.weighted_win_rate)) : null,
  };
}

const LiveStatsContext = createContext<Stats | null>(null);

// Polls the real homepage_platform_stats() aggregate every 20s instead of
// faking movement client-side. مستخدم ناسخ / متداول نشط can genuinely move
// up or down (the market-simulation cron adjusts follower counts both
// ways), while إجمالي حجم التداول and إجمالي الصفقات المنفذة are real
// cumulative counters that only ever grow as real trades close — polling
// the true values is the only way to show that growth honestly instead of
// simulating an increment that could drift from what's actually in the DB.
export function LiveStatsProvider({ initial, children }: { initial: Stats; children: ReactNode }) {
  const [stats, setStats] = useState(initial);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function poll() {
      const { data, error } = await supabase.rpc("homepage_platform_stats").single();
      if (!cancelled && !error && data) {
        setStats(deriveStats(data as RawStats));
      }
    }

    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return <LiveStatsContext.Provider value={stats}>{children}</LiveStatsContext.Provider>;
}

function useLiveStats(): Stats {
  const ctx = useContext(LiveStatsContext);
  if (!ctx) throw new Error("useLiveStats must be used within LiveStatsProvider");
  return ctx;
}

export function LiveActiveTraders({ className }: { className?: string }) {
  const { totalTraders } = useLiveStats();
  return (
    <p className={className} dir="ltr" suppressHydrationWarning>
      {totalTraders.toLocaleString("en-US")}+
    </p>
  );
}

export function LiveCopyUsers({ className }: { className?: string }) {
  const { totalCopiers } = useLiveStats();
  return (
    <p className={className} dir="ltr" suppressHydrationWarning>
      {totalCopiers.toLocaleString("en-US")}+
    </p>
  );
}

export function LiveTotalTrades({ className }: { className?: string }) {
  const { totalTrades } = useLiveStats();
  return (
    <p className={className} dir="ltr" suppressHydrationWarning>
      {totalTrades.toLocaleString("en-US")}+
    </p>
  );
}

export function LiveTotalVolume({ className }: { className?: string }) {
  const { totalVolume } = useLiveStats();
  return (
    <p
      className={className}
      dir="ltr"
      suppressHydrationWarning
      title={`$${totalVolume.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
    >
      ${totalVolume.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 })}
    </p>
  );
}

export function LiveWinRate({ className }: { className?: string }) {
  const { avgWinRate } = useLiveStats();
  return (
    <p className={className} suppressHydrationWarning>
      {avgWinRate != null ? `${avgWinRate}%` : "—"}
    </p>
  );
}

export function LiveBestReturn({ className }: { className?: string }) {
  const { bestReturn } = useLiveStats();
  return (
    <p className={className} dir="ltr" suppressHydrationWarning>
      {bestReturn != null ? `+${bestReturn}%` : "—"}
    </p>
  );
}
