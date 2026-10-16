import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowDownToLine, ArrowUpFromLine, CandlestickChart, Copy, RotateCcw, UsersRound, type LucideIcon } from "lucide-react";
import { ConfirmButton } from "@/components/ConfirmButton";
import { resetDemoBalance } from "@/app/portfolio/actions";

type Tile = {
  key: string;
  label: string;
  Icon: LucideIcon;
  tone: string;
  href?: string;
  /** Dimmed and not clickable; `note` says why, in words. */
  disabled?: boolean;
  note?: string;
  reset?: boolean;
};

const tileBase = "flex min-h-[5.5rem] flex-col items-center gap-2 rounded-[20px] border border-border bg-surface px-1 py-3 text-center transition";

// The shortcut row under the balance. A practice account never deposits or withdraws: it discovers
// traders, opens the markets, looks at its copies and can reset its balance. A real account deposits
// and withdraws (deposits are locked until they open, a withdrawal needs a balance) and goes to the
// traders and the markets.
export async function QuickActions({ mode, depositsOn, hasBalance }: { mode: "practice" | "real"; depositsOn: boolean; hasBalance: boolean }) {
  const t = await getTranslations("Dashboard");
  const tc = await getTranslations("Copies");
  const tm = await getTranslations("Markets");
  const tp = await getTranslations("Portfolio");

  const discover: Tile = { key: "discover", href: "/discover", label: tc("discover"), Icon: UsersRound, tone: "bg-success/12 text-success" };
  const markets: Tile = { key: "markets", href: "/discover?tab=markets", label: tm("backToMarkets"), Icon: CandlestickChart, tone: "bg-warning/12 text-warning" };

  const tiles: Tile[] =
    mode === "practice"
      ? [
          discover,
          markets,
          { key: "copies", href: "/copies", label: t("shortcutCopies"), Icon: Copy, tone: "bg-accent/15 text-accent-text" },
          { key: "reset", label: t("shortcutReset"), Icon: RotateCcw, tone: "bg-white/[0.06] text-foreground", reset: true },
        ]
      : [
          depositsOn
            ? { key: "deposit", href: "/portfolio/deposit", label: t("deposit"), Icon: ArrowDownToLine, tone: "bg-accent/15 text-accent-text" }
            : { key: "deposit", label: t("deposit"), Icon: ArrowDownToLine, tone: "bg-white/[0.06] text-muted", disabled: true, note: t("depositsOpenSoon") },
          hasBalance
            ? { key: "withdraw", href: "/portfolio/withdraw", label: t("withdraw"), Icon: ArrowUpFromLine, tone: "bg-white/[0.06] text-foreground" }
            : { key: "withdraw", label: t("withdraw"), Icon: ArrowUpFromLine, tone: "bg-white/[0.06] text-muted", disabled: true, note: t("withdrawNoBalance") },
          discover,
          markets,
        ];

  return (
    <nav aria-label={t("quickActionsTitle")} className="grid grid-cols-4 gap-2">
      {tiles.map(({ key, label, Icon, tone, href, disabled, note, reset }) => {
        const inner = (
          <>
            <span className={`flex h-10 w-10 items-center justify-center rounded-full ${tone}`}>
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="text-xs font-medium leading-tight">{label}</span>
            {note && <span className="text-[0.6875rem] leading-tight text-muted">{note}</span>}
          </>
        );
        if (reset) {
          return (
            <form key={key} action={resetDemoBalance} className="contents">
              <input type="hidden" name="returnTo" value="/dashboard" />
              <ConfirmButton confirmText={tp("resetDemoConfirm")} className={`${tileBase} w-full hover:border-accent/40`}>
                {inner}
              </ConfirmButton>
            </form>
          );
        }
        if (disabled || !href) {
          return (
            <div key={key} role="link" aria-disabled="true" className={`${tileBase} cursor-not-allowed opacity-60`}>
              {inner}
            </div>
          );
        }
        return (
          <Link key={key} href={href} className={`${tileBase} hover:border-accent/40`}>
            {inner}
          </Link>
        );
      })}
    </nav>
  );
}
