"use client";

import { useMoney } from "@/lib/money-client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import {
  HistoryPeriodSheet,
  type CustomRange,
  type HistoryPeriod,
  periodLabelKey,
} from "@/components/HistoryPeriodSheet";
import { tradeDeltaPoints } from "@/lib/pip-specs";

export type HistoryTrade = {
  id: string;
  symbol: string;
  side: string;
  lot: number | null;
  entry: number;
  exit: number;
  /** Realized result in USD; null when the lot size isn't known. */
  pnl: number | null;
  /** Direction-adjusted % return (negative for a loss). */
  pct: number;
  openedAt: string | null;
  closedAt: string | null;
  stopLoss: number | null;
  takeProfit: number | null;
  swap: number | null;
  commission: number | null;
  copyHref: string;
};

/** Every closed trade of the leader per UTC day and symbol (provider_trade_days):
 *  [day, symbol, trades, pnl, swap, commission], money in cents. */
export type TradeDay = [string, string, number, number, number, number];

const PAGE_SIZE = 40;
const DAY = 24 * 60 * 60 * 1000;
// N days = today and the N - 1 UTC days before it, like the leader's stats.
const WINDOW_DAYS: Partial<Record<HistoryPeriod, number>> = { week: 7, month: 30, threeMonths: 90, sixMonths: 180, year: 365 };

// The UTC day (YYYY-MM-DD) a period starts on; null = no lower bound.
function periodStart(period: HistoryPeriod, custom: CustomRange | null): string | null {
  if (period === "all") return null;
  if (period === "custom") return custom?.from ?? null;
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = period === "today" ? 1 : (WINDOW_DAYS[period] ?? 1);
  return new Date(today - (days - 1) * DAY).toISOString().slice(0, 10);
}

function withinPeriod(day: string | null, period: HistoryPeriod, custom: CustomRange | null) {
  if (!day) return false;
  const from = periodStart(period, custom);
  if (from && day < from) return false;
  if (period === "custom" && custom?.to && day > custom.to) return false;
  return true;
}

// A stable ticket number derived from the trade's own id.
function ticketFromId(id: string): string {
  let hash = 5381;
  for (let i = 0; i < id.length; i++) hash = (hash * 33 + id.charCodeAt(i)) >>> 0;
  return String(hash).padStart(9, "0").slice(-9);
}

// UTC getters so the server render and the browser agree in any timezone.
function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}.${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

const formatPrice = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 4 });
// Crypto lots step by 0.001, forex / gold by 0.01.
const formatLot = (v: number) => String(Number(v.toFixed(3)));
const signed = (v: number, text: string) => `${v > 0 ? "+" : v < 0 ? "-" : ""}${text}`;

const GAIN = "text-accent-hover";
const LOSS = "text-danger";

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

function Level({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1">
      <span className="text-muted">{label}</span>
      <span className="text-foreground" dir="ltr">
        {value != null ? formatPrice(value) : "-"}
      </span>
    </div>
  );
}

// `trades` holds the latest closed trades; `days` covers all of them, so the
// count and the totals of any period / symbol are exact even when the list
// only shows the most recent ones.
export function TraderTradeHistory({ trades, days }: { trades: HistoryTrade[]; days: TradeDay[] }) {
  const t = useTranslations("TraderHistory");
  const tp = useTranslations("TradeHistory");
  const ts = useTranslations("Symbols");
  const money = useMoney();
  const [period, setPeriod] = useState<HistoryPeriod>("all");
  const [custom, setCustom] = useState<CustomRange | null>(null);
  const [symbol, setSymbol] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const symbols = useMemo(() => Array.from(new Set(days.map((d) => d[1]))).sort(), [days]);
  const filtered = useMemo(
    () => trades.filter((x) => (!symbol || x.symbol === symbol) && withinPeriod(x.closedAt?.slice(0, 10) ?? null, period, custom)),
    [trades, symbol, period, custom],
  );

  // Integer cents, summed exactly.
  const totals = useMemo(() => {
    let count = 0;
    let profit = 0;
    let swap = 0;
    let commission = 0;
    for (const [day, sym, n, pnl, sw, comm] of days) {
      if ((symbol && sym !== symbol) || !withinPeriod(day, period, custom)) continue;
      count += n;
      profit += pnl;
      swap += sw;
      commission += comm;
    }
    return { count, profit: profit / 100, swap: swap / 100, commission: commission / 100 };
  }, [days, symbol, period, custom]);

  const close = useCallback(() => setSheetOpen(false), []);

  const periodText = period === "custom" ? (custom ? `${custom.from} → ${custom.to}` : t("custom")) : tp(periodLabelKey(period));

  const describe = (sym: string) => {
    if (sym === "XAUUSD") return t("goldVsUsd");
    return ts.has(sym as never) ? ts(sym as never) : null;
  };

  const shown = filtered.slice(0, visible);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">{tp("tradesCount", { count: totals.count })}</p>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-haspopup="dialog"
          className="flex min-h-9 max-w-[72%] items-center gap-2 rounded-lg border border-accent/30 bg-accent/15 px-3 py-1.5 text-sm font-medium text-accent-hover transition hover:bg-accent/25 motion-reduce:transition-none"
        >
          <ClockIcon />
          <span className="truncate" dir="auto">
            {periodText}
          </span>
          {symbol && (
            <span className="rounded bg-accent/20 px-1.5 text-xs" dir="ltr">
              {symbol}
            </span>
          )}
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>

      {totals.count === 0 ? (
        <p className="py-10 text-center text-sm text-muted">{tp("noTradesInPeriod")}</p>
      ) : (
        <ul className="flex flex-col">
          {shown.map((x) => {
            const open = expandedId === x.id;
            const gain = (x.pnl ?? x.pct) >= 0;
            const tone = gain ? GAIN : LOSS;
            const dirTone = x.side === "buy" ? GAIN : LOSS;
            const delta = tradeDeltaPoints(x.side, x.entry, x.exit);
            const desc = describe(x.symbol);
            const pnlText = x.pnl != null ? money(x.pnl, { signed: true }) : null;
            const detailId = `trade-detail-${x.id}`;
            return (
              <li key={x.id} className="border-b border-white/[0.05] last:border-b-0">
                <button
                  type="button"
                  onClick={() => setExpandedId(open ? null : x.id)}
                  aria-expanded={open}
                  aria-controls={detailId}
                  className="flex w-full flex-col gap-1 py-3 text-start"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex min-w-0 items-baseline gap-1.5 text-base" dir="ltr">
                      <span className="font-bold text-foreground">{x.symbol}</span>
                      <span className={`font-medium ${dirTone}`}>
                        {x.side}
                        {x.lot != null && ` ${formatLot(x.lot)}`}
                      </span>
                    </span>
                    <span className={`shrink-0 text-base font-bold ${tone}`} dir="ltr">
                      {pnlText ?? `${signed(x.pct, Math.abs(x.pct).toFixed(2))}%`}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 text-[13px] text-muted">
                    <span dir="ltr">
                      {formatPrice(x.entry)} → {formatPrice(x.exit)}
                    </span>
                    <span dir="ltr">{formatDateTime(x.closedAt)}</span>
                  </div>
                </button>

                <div
                  id={detailId}
                  className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${
                    open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                  }`}
                  aria-hidden={!open}
                >
                  <div className="overflow-hidden">
                    <div className="mb-3 flex flex-col gap-3 rounded-2xl bg-surface p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-base" dir="ltr">
                            <span className="font-bold">{x.symbol}</span>{" "}
                            <span className={`font-medium ${dirTone}`}>
                              {x.side}
                              {x.lot != null && ` ${formatLot(x.lot)}`}
                            </span>
                          </p>
                          {desc && <p className="text-sm text-muted">{desc}</p>}
                        </div>
                        <p className="shrink-0 text-sm text-muted" dir="ltr">
                          #{ticketFromId(x.id)}
                        </p>
                      </div>

                      <div className="flex items-baseline justify-between gap-3 border-t border-white/[0.06] pt-3">
                        <p className="min-w-0 whitespace-nowrap text-base" dir="ltr">
                          {formatPrice(x.entry)} → {formatPrice(x.exit)}
                        </p>
                        <p className={`shrink-0 text-base font-bold ${tone}`} dir="ltr">
                          {pnlText ?? "—"}
                        </p>
                      </div>

                      <p className={`text-sm font-medium ${tone}`}>
                        <bdi dir="ltr">
                          Δ = {signed(delta, formatPrice(Math.abs(delta)))} ({signed(x.pct, Math.abs(x.pct).toFixed(2))}%) {gain ? "▲" : "▼"}
                        </bdi>
                      </p>

                      <p className="text-[13px] text-muted">
                        <bdi dir="ltr">
                          {formatDateTime(x.openedAt)} → {formatDateTime(x.closedAt)}
                        </bdi>
                      </p>

                      <div className="grid grid-cols-2 gap-x-6 border-t border-white/[0.06] pt-2 text-sm">
                        <div>
                          <Level label="S/L" value={x.stopLoss} />
                          <Level label="T/P" value={x.takeProfit} />
                        </div>
                        <div>
                          <Level label={t("summarySwap")} value={x.swap} />
                          <Level label={t("charges")} value={x.commission} />
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <Link
                          href={`/markets?symbol=${x.symbol}`}
                          tabIndex={open ? 0 : -1}
                          className="rounded-xl bg-white/[0.06] py-3 text-center text-base font-medium text-accent-hover transition hover:bg-white/[0.1] motion-reduce:transition-none"
                        >
                          {tp("chart")}
                        </Link>
                        <Link
                          href={x.copyHref}
                          tabIndex={open ? 0 : -1}
                          className="rounded-xl bg-white/[0.06] py-3 text-center text-base font-medium text-accent-hover transition hover:bg-white/[0.1] motion-reduce:transition-none"
                        >
                          {tp("copy")}
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {totals.count > filtered.length && filtered.length <= visible && (
        <p className="text-center text-xs text-muted">{t("showingLatest", { shown: filtered.length, total: totals.count })}</p>
      )}

      {filtered.length > visible && (
        <button
          type="button"
          onClick={() => setVisible((v) => v + PAGE_SIZE)}
          className="rounded-xl bg-surface py-2.5 text-sm font-medium text-accent-hover transition hover:bg-white/[0.08]"
        >
          {tp("loadMore")}
        </button>
      )}

      {/* Period summary */}
      <dl className="mt-2 flex flex-col border-t border-white/[0.08] pt-1 text-[15px]">
        <div className="flex items-baseline justify-between py-1.5">
          <dt className="font-medium">{t("summaryProfit")}</dt>
          <dd className={`font-semibold ${totals.profit >= 0 ? "text-foreground" : LOSS}`} dir="ltr">
            {money(totals.profit, { signed: true })}
          </dd>
        </div>
        <div className="flex items-baseline justify-between py-1.5">
          <dt className="font-medium">{t("summarySwap")}</dt>
          <dd dir="ltr">{money(totals.swap)}</dd>
        </div>
        <div className="flex items-baseline justify-between py-1.5">
          <dt className="font-medium">{t("summaryCommission")}</dt>
          <dd dir="ltr">{money(totals.commission)}</dd>
        </div>
        <div className="flex items-baseline justify-between py-1.5">
          <dt className="font-medium">{t("summaryTrades")}</dt>
          <dd dir="ltr">{totals.count}</dd>
        </div>
      </dl>

      <HistoryPeriodSheet
        open={sheetOpen}
        onClose={close}
        period={period}
        custom={custom}
        symbol={symbol}
        symbols={symbols}
        onSelectPeriod={(p) => {
          setPeriod(p);
          setVisible(PAGE_SIZE);
          setExpandedId(null);
          setSheetOpen(false);
        }}
        onApplyCustom={(range) => {
          setCustom(range);
          setPeriod("custom");
          setVisible(PAGE_SIZE);
          setExpandedId(null);
          setSheetOpen(false);
        }}
        onSelectSymbol={(s) => {
          setSymbol(s);
          setVisible(PAGE_SIZE);
          setExpandedId(null);
        }}
      />
    </div>
  );
}
