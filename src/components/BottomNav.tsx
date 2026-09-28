"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

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
};

export function BottomNav() {
  const t = useTranslations("Nav");
  const pathname = usePathname();

  const items = [
    { href: "/dashboard", label: t("navHome"), icon: ICONS.home },
    { href: "/discover", label: t("navDiscover"), icon: ICONS.discover },
    { href: "/dashboard#my-copies", label: t("navMyCopies"), icon: ICONS.myCopies, matchPath: "/dashboard" },
    { href: "/portfolio?tab=positions", label: t("navTrades"), icon: ICONS.trades },
    { href: "/portfolio", label: t("navPortfolio"), icon: ICONS.portfolio },
  ];

  const isActive = (href: string, matchPath?: string) => {
    const path = matchPath ?? href.split("?")[0].split("#")[0];
    return pathname === path;
  };

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[9998] border-t border-white/[0.06] bg-[#0B132B]/95 backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label={t("menuAriaLabel")}
    >
      <div className="mx-auto flex max-w-5xl items-stretch justify-between px-1">
        {items.map((item) => {
          const active = isActive(item.href, item.matchPath);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition ${
                active ? "text-accent" : "text-muted"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {item.icon}
              </svg>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
