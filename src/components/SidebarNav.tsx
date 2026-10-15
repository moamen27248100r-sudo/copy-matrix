"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { MenuBody, MenuLogout } from "@/components/MenuBody";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useLocale } from "next-intl";
import type { Locale } from "@/i18n/locales";
import { Logo } from "@/components/Logo";

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

const STORAGE_KEY = "cm.sidebar";

// The desktop sidebar (1024px and up): the five pages, then the account menu. Full height, on the
// reading-start edge (right in Arabic, left in English), collapsible to icons; the choice is kept
// in this browser. The bottom bar is for phones and tablets only.
export function SidebarNav({
  isAdmin,
  isLeadTrader = false,
  accountNumber,
  displayName,
  email,
  kycStatus,
  accountType,
  embedded = false,
  activePath,
}: {
  isAdmin: boolean;
  isLeadTrader?: boolean;
  accountNumber: number | string;
  displayName?: string | null;
  email?: string | null;
  kycStatus: string;
  accountType: "real" | "demo";
  /** Rendered inside another element (the home-page device mock-up) instead of fixed to the screen edge. */
  embedded?: boolean;
  /** The page to show as current (the mock-up has no real route of its own). */
  activePath?: string;
}) {
  const t = useTranslations("Nav");
  const tm = useTranslations("AccountMenu");
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const locale = useLocale() as Locale;

  // The layout's inline script already put data-sidebar on <body> before paint (no jump); this
  // just brings the React state in line with it.
  useEffect(() => {
    const id = setTimeout(() => setCollapsed(document.body.dataset.sidebar === "collapsed"), 0);
    return () => clearTimeout(id);
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    if (next) document.body.dataset.sidebar = "collapsed";
    else delete document.body.dataset.sidebar;
    try {
      localStorage.setItem(STORAGE_KEY, next ? "collapsed" : "expanded");
    } catch {
      // private mode: the choice just isn't remembered
    }
  }

  const items = [
    { href: "/dashboard", label: t("navHome"), icon: ICONS.home },
    { href: "/discover", label: t("navDiscover"), icon: ICONS.discover },
    { href: "/copies", label: t("navMyCopies"), icon: ICONS.myCopies },
    { href: "/trades", label: t("navTrades"), icon: ICONS.trades },
    { href: "/portfolio", label: t("navPortfolio"), icon: ICONS.portfolio },
  ];
  const here = activePath ?? pathname;
  const isActive = (href: string) =>
    here === href || here.startsWith(`${href}/`) || (href === "/discover" && here.startsWith("/trader/"));

  const Collapse = collapsed ? ChevronsRight : ChevronsLeft;

  return (
    <aside
      className={
        embedded
          ? "flex h-full w-64 shrink-0 flex-col border-e border-white/[0.06] bg-[#0B132B]"
          : "fixed inset-y-0 start-0 z-[10000] hidden w-[var(--sidebar-w)] flex-col border-e border-white/[0.06] bg-[#0B132B] lg:flex"
      }
      aria-label={t("menuAriaLabel")}
    >
      <div className={`flex h-16 shrink-0 items-center ${collapsed ? "justify-center" : "justify-between ps-5 pe-3"}`}>
        {!collapsed && (
          <Link href="/dashboard" className="flex min-w-0 items-center overflow-hidden" aria-label="Copy Matrix">
            <Logo iconClassName="h-5 w-5" textClassName="text-xl" />
          </Link>
        )}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? tm("expandSidebar") : tm("collapseSidebar")}
          title={collapsed ? tm("expandSidebar") : tm("collapseSidebar")}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-white/5 hover:text-foreground rtl:rotate-180"
        >
          <Collapse className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      <div className="scroll-subtle flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
        <nav className="flex flex-col gap-0.5 px-2 pb-1" aria-label={t("menuAriaLabel")}>
          {items.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                aria-label={collapsed ? item.label : undefined}
                aria-current={active ? "page" : undefined}
                className={`relative flex items-center rounded-xl py-2.5 text-sm transition ${collapsed ? "justify-center px-0" : "gap-3 px-3"} ${
                  active
                    ? "bg-gradient-to-r from-accent/25 to-brand/10 font-bold text-accent"
                    : "font-medium text-muted hover:bg-white/5"
                }`}
              >
                {active && <span className="absolute inset-y-1 start-0 w-[3px] rounded-full bg-gradient-to-b from-accent to-brand" aria-hidden="true" />}
                <svg viewBox="0 0 24 24" className="h-[22px] w-[22px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {item.icon}
                </svg>
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="mt-2 flex flex-1 flex-col border-t border-white/[0.06]">
          <MenuBody
            isAdmin={isAdmin}
            isLeadTrader={isLeadTrader}
            accountNumber={accountNumber}
            displayName={displayName}
            email={email}
            kycStatus={kycStatus}
            accountType={accountType}
            compact={collapsed}
            inSidebar
          />
        </div>
      </div>

      {/* Pinned to the bottom of the sidebar at every window height: language and log out. */}
      <div className={`shrink-0 border-t border-white/[0.06] bg-[#0B132B] px-2 py-2 ${collapsed ? "flex flex-col items-center gap-2" : "flex items-center gap-2"}`}>
        <div className={collapsed ? "" : "shrink-0 ps-1"}>
          <LanguageSwitcher currentLocale={locale} />
        </div>
        <div className="min-w-0 flex-1">
          <MenuLogout compact={collapsed} />
        </div>
      </div>
    </aside>
  );
}
