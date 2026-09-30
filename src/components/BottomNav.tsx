"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

// Unified 24px line icons (1.75 stroke, round caps) drawn for the platform.
const ICONS = {
  home: (
    <>
      <path d="M4 11.2 12 4l8 7.2" />
      <path d="M6 10v9.5h12V10" />
      <path d="M10 19.5v-5h4v5" />
    </>
  ),
  discover: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15.4 8.6-1.9 4.9-4.9 1.9 1.9-4.9z" />
    </>
  ),
  myCopies: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2.5" />
      <path d="M15 9V6.5A2.5 2.5 0 0 0 12.5 4h-6A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15H9" />
    </>
  ),
  trades: (
    <>
      <path d="M7 4v16M7 8H5v6h2M7 14h2V8H7" />
      <path d="M17 4v16M17 10h-2v7h2M17 17h2v-7h-2" />
    </>
  ),
  portfolio: (
    <>
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 17.5z" />
      <path d="M4 8.5V6.2A2.2 2.2 0 0 1 6.2 4H16" />
      <circle cx="16" cy="13.5" r="1.2" />
    </>
  ),
};

export function BottomNav() {
  const t = useTranslations("Nav");
  const pathname = usePathname();

  const items: { href: string; label: string; icon: React.ReactNode }[] = [
    { href: "/dashboard", label: t("navHome"), icon: ICONS.home },
    { href: "/discover", label: t("navDiscover"), icon: ICONS.discover },
    { href: "/copies", label: t("navMyCopies"), icon: ICONS.myCopies },
    { href: "/trades", label: t("navTrades"), icon: ICONS.trades },
    { href: "/portfolio", label: t("navPortfolio"), icon: ICONS.portfolio },
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {/* Publishes the nav height so sticky page bars (e.g. the trader copy
          bar) can sit directly on top of it; 0 from lg up, where it's hidden. */}
      <style>{`:root{--bottom-nav-h:calc(57px + env(safe-area-inset-bottom,0px))}@media(min-width:1024px){:root{--bottom-nav-h:0px}}`}</style>
      <nav
        className="fixed inset-x-0 bottom-0 z-[9998] border-t border-white/[0.08] bg-[#0b1726] lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        aria-label={t("menuAriaLabel")}
      >
        <div className="mx-auto flex h-14 max-w-5xl items-stretch">
          {items.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`group relative flex min-h-[44px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium transition-colors duration-200 motion-reduce:transition-none ${
                  active ? "text-brand" : "text-muted active:text-foreground"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute top-0 h-[3px] rounded-b-full bg-brand transition-all duration-200 motion-reduce:transition-none ${
                    active ? "w-8 opacity-100" : "w-0 opacity-0"
                  }`}
                />
                <svg
                  viewBox="0 0 24 24"
                  className={`h-6 w-6 transition-transform duration-200 motion-reduce:transition-none ${active ? "scale-105" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={active ? 2 : 1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {item.icon}
                </svg>
                <span className="w-full truncate text-center leading-tight">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
