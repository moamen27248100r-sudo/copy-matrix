"use client";

import { SymbolIcon, symbolColor } from "@/lib/symbol-icons";
import { showcaseNotifications } from "@/data/showcase-data";

const TICKS_PER_NOTIFICATION = 3; // matches the "every 3s" requirement off the 1s central tick
const STACK_STYLE = [
  { scale: 1, opacity: 1 },
  { scale: 0.96, opacity: 0.75 },
  { scale: 0.92, opacity: 0.5 },
];

export function TradeNotificationStack({
  tick,
  count,
  compact = false,
}: {
  tick: number;
  count: 2 | 3;
  compact?: boolean;
}) {
  const generation = Math.floor(tick / TICKS_PER_NOTIFICATION);
  const items = Array.from({ length: count }, (_, i) => generation - i)
    .filter((g) => g >= 0)
    .map((g) => ({ gen: g, note: showcaseNotifications[g % showcaseNotifications.length] }));

  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {items.map(({ gen, note }, i) => {
        const style = STACK_STYLE[i] ?? STACK_STYLE[STACK_STYLE.length - 1];
        const up = note.pnl >= 0;
        return (
          <div
            key={gen}
            className="showcase-notif-in origin-top overflow-hidden rounded-xl border border-white/10 bg-white/[0.06] shadow-xl shadow-black/40 backdrop-blur-xl transition-[transform,opacity] duration-500"
            style={{ transform: `scale(${style.scale})`, opacity: style.opacity }}
          >
            <div className="flex items-stretch">
              <span className={"w-1 shrink-0 " + (up ? "bg-[#22C55E]" : "bg-[#EF4444]")} />
              {compact ? (
                <div className="flex flex-1 flex-col items-center gap-0.5 p-1.5 text-center">
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px]"
                    style={{ backgroundColor: `${symbolColor(note.symbol)}22` }}
                  >
                    <SymbolIcon symbol={note.symbol} />
                  </span>
                  <span className={"text-[9px] font-bold tabular-nums leading-none " + (up ? "text-[#22C55E]" : "text-[#EF4444]")} dir="ltr">
                    {up ? "+" : ""}
                    {note.pnl}$
                  </span>
                </div>
              ) : (
                <div className="flex flex-1 items-center gap-2 p-2.5">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm"
                    style={{ backgroundColor: `${symbolColor(note.symbol)}22` }}
                  >
                    <SymbolIcon symbol={note.symbol} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium text-white">
                      تم إغلاق صفقة <span dir="ltr">{note.symbol}</span>
                    </p>
                    <div className="flex items-center gap-1.5">
                      <span className={"text-[11px] font-bold tabular-nums " + (up ? "text-[#22C55E]" : "text-[#EF4444]")} dir="ltr">
                        {up ? "▲" : "▼"} {up ? "+" : ""}
                        {note.pnl}$
                      </span>
                      <span className="text-[9px] text-muted">الآن</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

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
