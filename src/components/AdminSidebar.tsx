"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

const ICONS: Record<string, ReactNode> = {
  overview: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </>
  ),
  users: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  traders: (
    <>
      <path d="M23 6l-9.5 9.5-5-5L1 18" />
      <path d="M17 6h6v6" />
    </>
  ),
  kyc: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  wallet: (
    <>
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <circle cx="16" cy="14" r="1" />
    </>
  ),
  copy: (
    <>
      <path d="M17 1l4 4-4 4" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <path d="M7 23l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </>
  ),
  log: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </>
  ),
};

const NAV_ITEMS = [
  { href: "/admin", label: "نظرة عامة", icon: "overview" },
  { href: "/admin/users", label: "المستخدمون", icon: "users" },
  { href: "/admin/traders", label: "المتداولون", icon: "traders" },
  { href: "/admin/kyc", label: "طلبات التوثيق", icon: "kyc" },
  { href: "/admin/wallet-requests", label: "طلبات المحفظة", icon: "wallet" },
  { href: "/admin/subscriptions", label: "نشاط النسخ", icon: "copy" },
  { href: "/admin/audit-log", label: "سجل الإجراءات", icon: "log" },
] as const;

function ItemIcon({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

function isItemActive(pathname: string | null, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname?.startsWith(href);
}

function NavList({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = isItemActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={
              active
                ? "flex items-center gap-2.5 rounded-lg bg-accent/15 px-3 py-2.5 text-sm font-medium text-accent"
                : "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-muted transition hover:bg-surface hover:text-foreground"
            }
          >
            <ItemIcon name={item.icon} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-[57px] hidden h-[calc(100vh-57px)] w-56 shrink-0 overflow-y-auto border-e border-border p-3 sm:top-[65px] sm:block sm:h-[calc(100vh-65px)]">
      <NavList pathname={pathname} />
    </aside>
  );
}

export function AdminMobileMenuButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useBodyScrollLock(open);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="قائمة الأقسام"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-border text-foreground"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      <div
        className={
          open
            ? "fixed inset-x-0 top-14 bottom-0 z-40 bg-black/50 transition-opacity duration-300"
            : "fixed inset-x-0 top-14 bottom-0 z-40 bg-black/50 opacity-0 pointer-events-none transition-opacity duration-300"
        }
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div
        className={
          open
            ? "fixed top-14 bottom-0 right-0 z-40 w-[75%] max-w-xs translate-x-0 overflow-y-auto bg-surface p-3 shadow-xl transition-transform duration-300 ease-out"
            : "fixed top-14 bottom-0 right-0 z-40 w-[75%] max-w-xs translate-x-full overflow-y-auto bg-surface p-3 shadow-xl transition-transform duration-300 ease-out"
        }
      >
        <NavList pathname={pathname} onNavigate={() => setOpen(false)} />
      </div>
    </div>
  );
}
