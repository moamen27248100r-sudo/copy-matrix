"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { logout } from "@/app/auth/actions";
import { useNavDrawer } from "@/components/nav-drawer-context";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "لوحة التحكم",
    icon: (
      <>
        <path d="M3 11l9-8 9 8" />
        <path d="M5 10v10h14V10" />
      </>
    ),
  },
  {
    href: "/discover",
    label: "اكتشاف المتداولين",
    icon: (
      <>
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </>
    ),
  },
  {
    href: "/markets",
    label: "الأسواق",
    icon: (
      <>
        <path d="M3 3v18h18" />
        <path d="M7 15l4-5 3 3 5-7" />
      </>
    ),
  },
  {
    href: "/portfolio",
    label: "محفظتي",
    icon: (
      <>
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </>
    ),
  },
  {
    href: "/portfolio#following",
    label: "المتداولون المتابَعون",
    icon: (
      <>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
  },
];

const PAYMENT_ITEMS = [
  {
    href: "/portfolio#wallet",
    label: "إيداع",
    icon: (
      <>
        <path d="M12 19V5" />
        <path d="M5 12l7 7 7-7" />
      </>
    ),
  },
  {
    href: "/portfolio#wallet",
    label: "سحب",
    icon: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12l7-7 7 7" />
      </>
    ),
  },
];

const ACCOUNT_ITEMS = [
  {
    href: "/kyc",
    label: "توثيق الهوية",
    icon: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </>
    ),
  },
  {
    href: "/settings",
    label: "الإعدادات",
    icon: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </>
    ),
  },
];

const ADMIN_ITEM = {
  href: "/admin",
  label: "لوحة الإدارة",
  icon: (
    <>
      <path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" />
    </>
  ),
};

function SectionLabel({ children }: { children: string }) {
  return <p className="px-4 pt-4 pb-1 text-xs font-medium text-muted">{children}</p>;
}

export function MainMenu({
  balance,
  isAdmin,
  displayName,
  email,
}: {
  balance: number | null;
  isAdmin: boolean;
  displayName?: string | null;
  email?: string | null;
}) {
  const { open, toggle, close } = useNavDrawer("menu");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const accountItems = isAdmin ? [...ACCOUNT_ITEMS, ADMIN_ITEM] : ACCOUNT_ITEMS;

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-label="القائمة"
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
            ? "fixed inset-x-0 top-14 bottom-0 z-40 bg-black/50 transition-opacity duration-300 sm:top-16"
            : "fixed inset-x-0 top-14 bottom-0 z-40 bg-black/50 opacity-0 pointer-events-none transition-opacity duration-300 sm:top-16"
        }
        onClick={close}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        className={
          open
            ? "fixed top-14 bottom-0 right-0 z-40 flex w-[65%] max-w-xs translate-x-0 flex-col overflow-y-auto bg-surface shadow-xl transition-transform duration-300 ease-out sm:top-16"
            : "fixed top-14 bottom-0 right-0 z-40 flex w-[65%] max-w-xs translate-x-full flex-col overflow-y-auto bg-surface shadow-xl transition-transform duration-300 ease-out sm:top-16"
        }
      >
            <div className="border-b border-border px-4 py-3">
              <span className="truncate text-sm font-medium" dir="ltr">
                {email ?? "—"}
              </span>
            </div>

            <Link
              href="/portfolio"
              onClick={close}
              className="flex flex-col gap-0.5 border-b border-border bg-background px-4 py-4"
            >
              {displayName && <span className="text-xs text-muted">{displayName}</span>}
              <span className="text-xl font-semibold">
                {balance != null
                  ? `$${Number(balance).toLocaleString("en-US", { maximumFractionDigits: 2 })}`
                  : "—"}
              </span>
              <span className="text-xs text-muted">الرصيد المتاح</span>
            </Link>

            <SectionLabel>التنقل</SectionLabel>
            <div className="flex flex-col pb-2">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={close}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-background"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {item.icon}
                  </svg>
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="border-t border-border" />

            <SectionLabel>المدفوعات</SectionLabel>
            <div className="flex flex-col pb-2">
              {PAYMENT_ITEMS.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={close}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-background"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {item.icon}
                  </svg>
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="border-t border-border" />

            <SectionLabel>الحساب</SectionLabel>
            <div className="flex flex-col pb-2">
              {accountItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={close}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-background"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {item.icon}
                  </svg>
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="mt-auto border-t border-border">
              <form action={logout}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-sm text-danger hover:bg-background"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <path d="M16 17l5-5-5-5" />
                    <path d="M21 12H9" />
                  </svg>
                  تسجيل الخروج
                </button>
              </form>
            </div>
      </div>
    </>
  );
}
