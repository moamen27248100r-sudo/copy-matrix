import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowDownToLine, ArrowUpFromLine, CandlestickChart, UsersRound } from "lucide-react";

// The four things a customer does most from the home page, one tap each (the shortcut row the big
// exchanges put under the balance).
export async function QuickActions() {
  const t = await getTranslations("Dashboard");
  const tc = await getTranslations("Copies");
  const tm = await getTranslations("Markets");
  const items = [
    { href: "/portfolio/deposit", label: t("deposit"), Icon: ArrowDownToLine, tone: "bg-accent/15 text-accent-text" },
    { href: "/portfolio/withdraw", label: t("withdraw"), Icon: ArrowUpFromLine, tone: "bg-white/[0.06] text-foreground" },
    { href: "/discover", label: tc("discover"), Icon: UsersRound, tone: "bg-success/12 text-success" },
    { href: "/discover?tab=markets", label: tm("backToMarkets"), Icon: CandlestickChart, tone: "bg-warning/12 text-warning" },
  ];
  return (
    <nav aria-label={t("quickActionsTitle")} className="grid grid-cols-4 gap-2">
      {items.map(({ href, label, Icon, tone }) => (
        <Link
          key={href}
          href={href}
          className="flex flex-col items-center gap-2 rounded-[20px] border border-border bg-surface px-1 py-3 text-center transition hover:border-accent/40"
        >
          <span className={`flex h-10 w-10 items-center justify-center rounded-full ${tone}`}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-xs font-medium leading-tight">{label}</span>
        </Link>
      ))}
    </nav>
  );
}
