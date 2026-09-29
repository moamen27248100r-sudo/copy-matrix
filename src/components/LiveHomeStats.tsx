"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { simulatedCopyUsers, simulatedActiveTraders } from "@/lib/simulated-growth";

type RawStats = {
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

const POLL_MS = 20000;
const GROWTH_TICK_MS = 15000;

function deriveRealStats(raw: RawStats) {
  return {
    totalTrades: Number(raw.total_trades ?? 0),
    totalVolume: Number(raw.total_volume ?? 0),
    bestReturn: raw.best_daily_return != null ? Number(raw.best_daily_return) : null,
    avgWinRate: raw.weighted_win_rate != null ? Math.round(Number(raw.weighted_win_rate)) : null,
  };
}

const LiveStatsContext = createContext<Stats | null>(null);

// إجمالي حجم التداول and إجمالي الصفقات المنفذة are real cumulative
// counters — polled from the real homepage_platform_stats() aggregate
// every 20s so they only ever grow, honestly, because the underlying
// data only ever grows. مستخدم ناسخ / متداول نشط are a deliberately
// simulated growth curve (see simulated-growth.ts) recomputed from
// wall-clock time every 15s — no backend call needed since it's a pure
// function of "now".
export function LiveStatsProvider({ initial, children }: { initial: Stats; children: ReactNode }) {
  const [stats, setStats] = useState(initial);

  useEffect(() => {
    function tickGrowth() {
      const now = Date.now();
      setStats((prev) => ({
        ...prev,
        totalCopiers: simulatedCopyUsers(now),
        totalTraders: simulatedActiveTraders(now),
      }));
    }

    const growthId = setInterval(tickGrowth, GROWTH_TICK_MS);

    const supabase = createClient();
    let cancelled = false;
    async function pollReal() {
      const { data, error } = await supabase.rpc("homepage_platform_stats").single();
      if (!cancelled && !error && data) {
        setStats((prev) => ({ ...prev, ...deriveRealStats(data as RawStats) }));
      }
    }
    const pollId = setInterval(pollReal, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(growthId);
      clearInterval(pollId);
    };
  }, []);

  return <LiveStatsContext.Provider value={stats}>{children}</LiveStatsContext.Provider>;
}

function useLiveStats(): Stats {
  const ctx = useContext(LiveStatsContext);
  if (!ctx) throw new Error("useLiveStats must be used within LiveStatsProvider");
  return ctx;
}

// A number that's only ever spotted mid-scroll (it's inside a moving
// marquee) is easy to miss updating even when it genuinely does — the
// eye is busy tracking position, not reading digits. Remounting the
// span (via `key`) on every value change retriggers a brief color/scale
// pop so the update itself is unmistakable, independent of the strip's
// own motion.
function useFlashKey(value: number): number {
  const [flashKey, setFlashKey] = useState(0);
  const prevRef = useRef(value);
  useEffect(() => {
    if (prevRef.current !== value) {
      prevRef.current = value;
      setFlashKey((k) => k + 1);
    }
  }, [value]);
  return flashKey;
}

export function LiveActiveTraders({ className }: { className?: string }) {
  const { totalTraders } = useLiveStats();
  const flashKey = useFlashKey(totalTraders);
  return (
    <p className={className} dir="ltr" suppressHydrationWarning>
      <span key={flashKey} className="inline-block animate-[stat-flash_0.7s_ease-out]">
        {totalTraders.toLocaleString("en-US")}+
      </span>
    </p>
  );
}

export function LiveCopyUsers({ className }: { className?: string }) {
  const { totalCopiers } = useLiveStats();
  const flashKey = useFlashKey(totalCopiers);
  return (
    <p className={className} dir="ltr" suppressHydrationWarning>
      <span key={flashKey} className="inline-block animate-[stat-flash_0.7s_ease-out]">
        {totalCopiers.toLocaleString("en-US")}+
      </span>
    </p>
  );
}

export function LiveTotalTrades({ className }: { className?: string }) {
  const { totalTrades } = useLiveStats();
  const flashKey = useFlashKey(totalTrades);
  return (
    <p className={className} dir="ltr" suppressHydrationWarning>
      <span key={flashKey} className="inline-block animate-[stat-flash_0.7s_ease-out]">
        {totalTrades.toLocaleString("en-US")}+
      </span>
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
