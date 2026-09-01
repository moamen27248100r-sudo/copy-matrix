"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

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

export function AdminNavTabs() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-2 pb-3">
      {NAV_ITEMS.map((item) => {
        const isActive = item.href === "/admin" ? pathname === "/admin" : pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              isActive
                ? "flex items-center gap-1.5 whitespace-nowrap rounded-full border border-accent bg-accent/15 px-3 py-1.5 text-sm font-medium text-accent transition"
                : "flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border px-3 py-1.5 text-sm text-muted transition hover:border-accent/40 hover:bg-surface hover:text-foreground"
            }
          >
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {ICONS[item.icon]}
            </svg>
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
