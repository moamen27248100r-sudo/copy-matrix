"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { logout } from "@/app/auth/actions";

const ICONS = {
  home: (
    <>
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </>
  ),
  discover: (
    <>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </>
  ),
  myCopies: (
    <>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </>
  ),
  trades: (
    <>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </>
  ),
  portfolio: (
    <>
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </>
  ),
  kyc: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
  support: (
    <>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="4" />
      <line x1="4.93" y1="4.93" x2="9.17" y2="9.17" />
      <line x1="14.83" y1="14.83" x2="19.07" y2="19.07" />
      <line x1="14.83" y1="9.17" x2="19.07" y2="4.93" />
      <line x1="4.93" y1="19.07" x2="9.17" y2="14.83" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </>
  ),
};

function NavRow({ href, label, icon, active }: { href: string; label: string; icon: React.ReactNode; active: boolean }) {
  return (
    <Link
      href={href}
      className={
        active
          ? "relative flex items-center gap-3 overflow-hidden rounded-xl bg-gradient-to-r from-accent/25 to-brand/10 px-3 py-2.5 text-sm font-semibold text-accent"
          : "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-foreground/90 transition hover:bg-white/5"
      }
    >
      {active && (
        <span className="absolute inset-y-1 start-0 w-[3px] rounded-full bg-gradient-to-b from-accent to-brand" aria-hidden="true" />
      )}
      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {icon}
      </svg>
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function SidebarNav({ isAdmin }: { isAdmin: boolean }) {
  const t = useTranslations("Nav");
  const pathname = usePathname();

  const primaryItems = [
    { href: "/dashboard", label: t("navHome"), icon: ICONS.home },
    { href: "/discover", label: t("navDiscover"), icon: ICONS.discover },
    { href: "/dashboard#my-copies", label: t("navMyCopies"), icon: ICONS.myCopies, matchPath: "/dashboard" },
    { href: "/portfolio?tab=positions", label: t("navTrades"), icon: ICONS.trades },
    { href: "/portfolio", label: t("navPortfolio"), icon: ICONS.portfolio },
  ];
  const secondaryItems = [
    { href: "/kyc", label: t("menuKyc"), icon: ICONS.kyc },
    { href: "/settings", label: t("menuSettings"), icon: ICONS.settings },
    { href: "/support", label: t("menuSupport"), icon: ICONS.support },
    ...(isAdmin ? [{ href: "/admin", label: t("menuAdmin"), icon: ICONS.kyc }] : []),
  ];

  const isActive = (href: string, matchPath?: string) => {
    const path = matchPath ?? href.split("?")[0].split("#")[0];
    return pathname === path;
  };

  return (
    <aside className="fixed bottom-0 start-0 top-14 z-[9997] hidden w-64 flex-col border-e border-white/[0.06] bg-[#0B132B]/95 backdrop-blur-xl sm:top-16 lg:flex">
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4">
        {primaryItems.map((item) => (
          <NavRow key={item.href} {...item} active={isActive(item.href, item.matchPath)} />
        ))}

        <div className="my-3 h-px bg-white/[0.06]" aria-hidden="true" />

        {secondaryItems.map((item) => (
          <NavRow key={item.href} {...item} active={isActive(item.href)} />
        ))}
      </nav>

      <div className="border-t border-white/[0.06] p-3">
        <form action={logout}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-danger transition hover:bg-danger/10"
          >
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {ICONS.logout}
            </svg>
            {t("logout")}
          </button>
        </form>
      </div>
    </aside>
  );
}
