import { getMoney } from "@/lib/money-server";
import { getLocale, getTranslations } from "next-intl/server";
import { formatDate } from "@/lib/locale-format";
import type { Locale } from "@/i18n/locales";

export type ActivityEvent = {
  id: string;
  type: "position_opened" | "position_closed_win" | "position_closed_loss" | "copy_started" | "deposit" | "withdrawal";
  at: string;
  providerName?: string;
  symbol?: string;
  amount?: number;
};

function EventIcon({ type }: { type: ActivityEvent["type"] }) {
  const paths: Record<ActivityEvent["type"], React.ReactNode> = {
    position_opened: <path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />,
    position_closed_win: <path d="M23 6l-9.5 9.5-5-5L1 18M17 6h6v6" />,
    position_closed_loss: <path d="M23 18l-9.5-9.5-5 5L1 6M17 18h6v-6" />,
    copy_started: (
      <>
        <rect x="9" y="9" width="12" height="12" rx="2" />
        <path d="M5 15V5a2 2 0 0 1 2-2h10" />
      </>
    ),
    deposit: <path d="M12 5v14M5 12l7 7 7-7" />,
    withdrawal: <path d="M12 19V5M5 12l7-7 7 7" />,
  };
  const tone: Record<ActivityEvent["type"], string> = {
    position_opened: "text-accent bg-accent/10",
    position_closed_win: "text-success bg-success/10",
    position_closed_loss: "text-danger bg-danger/10",
    copy_started: "text-accent bg-accent/10",
    deposit: "text-success bg-success/10",
    withdrawal: "text-warning bg-warning/10",
  };
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone[type]}`}>
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {paths[type]}
      </svg>
    </span>
  );
}

export async function RecentActivityTimeline({ events }: { events: ActivityEvent[] }) {
  const t = await getTranslations("Dashboard");
  const money = await getMoney();
  const locale = (await getLocale()) as Locale;
  if (events.length === 0) return null;

  const label = (e: ActivityEvent) => {
    switch (e.type) {
      case "position_opened":
        return t("activityPositionOpened", { symbol: e.symbol ?? "" });
      case "position_closed_win":
        return t("activityPositionClosedWin", { symbol: e.symbol ?? "" });
      case "position_closed_loss":
        return t("activityPositionClosedLoss", { symbol: e.symbol ?? "" });
      case "copy_started":
        return t("activityCopyStarted", { name: e.providerName ?? "" });
      case "deposit":
        return t("activityDeposit", { amount: money(Number(e.amount ?? 0)) });
      case "withdrawal":
        return t("activityWithdrawal", { amount: money(Number(e.amount ?? 0)) });
    }
  };

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">{t("recentActivityTitle")}</h2>
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
        {events.map((e) => (
          <div key={e.id} className="flex items-center gap-3">
            <EventIcon type={e.type} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{label(e)}</p>
            </div>
            <span className="shrink-0 text-xs text-muted" dir="ltr">
              {formatDate(e.at, locale, { month: "short", day: "numeric" })}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
