"use client";

import { useTranslations } from "next-intl";
import { SymbolIcon, symbolColor } from "@/lib/symbol-icons";
import { showcaseNotifications } from "@/data/showcase-data";

const TICKS_PER_NOTIFICATION = 3; // matches the "every 3s" requirement off the 1s central tick
const STACK_STYLE = [
  { scale: 1, opacity: 1 },
  { scale: 0.96, opacity: 0.75 },
  { scale: 0.92, opacity: 0.5 },
];

function NotificationCard({ symbol, pnl, style }: { symbol: string; pnl: number; style?: { scale: number; opacity: number } }) {
  const t = useTranslations("HomeShowcase");
  const up = pnl >= 0;
  return (
    <div
      className="showcase-notif-in flex w-[210px] min-w-[210px] shrink-0 origin-top items-stretch overflow-hidden rounded-xl border border-white/10 bg-[#0b0e14]/90 shadow-xl shadow-black/40 backdrop-blur-xl transition-[transform,opacity] duration-500 lg:w-[260px] lg:min-w-[260px]"
      style={style ? { transform: `scale(${style.scale})`, opacity: style.opacity } : undefined}
    >
      <span className={"w-1 shrink-0 " + (up ? "bg-[#22C55E]" : "bg-[#EF4444]")} />
      <div className="flex min-w-0 flex-1 items-center gap-2.5 p-2.5">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base"
          style={{ backgroundColor: `${symbolColor(symbol)}22` }}
        >
          <SymbolIcon symbol={symbol} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="overflow-hidden text-ellipsis whitespace-nowrap text-[12px] font-medium text-white">
            {t("tradeClosed", { symbol: `\u2066${symbol}\u2069` })}
          </p>
          <p className="text-[10px] text-muted">{t("now")}</p>
        </div>
        <span className={"shrink-0 text-[12px] font-bold tabular-nums " + (up ? "text-[#22C55E]" : "text-[#EF4444]")} dir="ltr">
          {up ? "▲" : "▼"} {up ? "+" : ""}
          {pnl}$
        </span>
      </div>
    </div>
  );
}

export function TradeNotificationStack({ tick, count }: { tick: number; count: 1 | 3 }) {
  const generation = Math.floor(tick / TICKS_PER_NOTIFICATION);
  const items = Array.from({ length: count }, (_, i) => generation - i)
    .filter((g) => g >= 0)
    .map((g) => ({ gen: g, note: showcaseNotifications[g % showcaseNotifications.length] }));

  return (
    <div className="flex flex-col gap-2.5" aria-hidden="true">
      {items.map(({ gen, note }, i) => (
        <NotificationCard key={gen} symbol={note.symbol} pnl={note.pnl} style={count > 1 ? STACK_STYLE[i] : undefined} />
      ))}

      <style>{`
        @keyframes showcaseNotifIn {
          from { transform: translateY(-14px); opacity: 0; }
        }
        .showcase-notif-in {
          animation: showcaseNotifIn 400ms ease-out;
        }
      `}</style>
    </div>
  );
}
