"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { logout } from "@/app/auth/actions";
import { useNavDrawer } from "@/components/nav-drawer-context";

const TRADING_ITEMS = [
  {
    href: "/dashboard#accounts",
    label: "الحسابات",
    icon: (
      <>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
      </>
    ),
  },
  {
    href: "/portfolio",
    label: "الأداء",
    icon: (
      <>
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </>
    ),
  },
  {
    href: "/portfolio?tab=positions",
    label: "سجل الأوامر",
    icon: (
      <>
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
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

function WalletIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-1" />
      <path d="M21 12H15a2 2 0 0 0 0 4h6z" />
    </svg>
  );
}

function CandlestickIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6 shrink-0 text-muted"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <g transform="translate(12 12) scale(1.15) translate(-12 -12)">
        <line x1="6" y1="2" x2="6" y2="4" />
        <rect x="3.2" y="4" width="5.6" height="9" rx="0.75" />
        <line x1="6" y1="13" x2="6" y2="15" />

        <line x1="12" y1="5" x2="12" y2="8" />
        <rect x="9.2" y="8" width="5.6" height="7.5" rx="0.75" />
        <line x1="12" y1="15.5" x2="12" y2="19" />

        <line x1="18" y1="3" x2="18" y2="5" />
        <rect x="15.2" y="5" width="5.6" height="9" rx="0.75" />
        <line x1="18" y1="14" x2="18" y2="16" />
      </g>
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

// Masks the local part of an email for privacy: "delta126@gmail.com" -> "d****6@gmail.com".
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  if (local.length <= 2) return `${local[0]}****@${domain}`;
  return `${local[0]}****${local[local.length - 1]}@${domain}`;
}

function ForwardArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

export function MainMenu({
  balance,
  isAdmin,
  displayName,
  email,
  activeCopyProviderId,
  activeCopyProviderName,
  followsCount,
}: {
  balance: number | null;
  isAdmin: boolean;
  displayName?: string | null;
  email?: string | null;
  activeCopyProviderId?: string | null;
  activeCopyProviderName?: string | null;
  followsCount?: number;
}) {
  const { open, toggle, close } = useNavDrawer("menu");
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const [copyOpen, setCopyOpen] = useState(true);
  const [hash, setHash] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    setHash(window.location.hash);
    setSearch(window.location.search.replace(/^\?/, ""));
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [pathname]);

  const accountItems = isAdmin ? [...ACCOUNT_ITEMS, ADMIN_ITEM] : ACCOUNT_ITEMS;

  const isActive = (href: string) => {
    const [pathAndQuery, hashPart] = href.split("#");
    const [path, query] = pathAndQuery.split("?");
    if (path !== pathname) return false;
    if (hashPart) return hash === `#${hashPart}`;
    if (query) return search === query;
    return !hash && !search;
  };

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
            <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background text-muted">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" />
                  </svg>
                </span>
                <span className="truncate text-sm font-medium" dir="ltr">
                  {email ? maskEmail(email) : "—"}
                </span>
              </div>
              <Link href="/settings" onClick={close} aria-label="إعدادات الحساب" className="shrink-0 text-muted">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </Link>
            </div>

            <Link
              href="/portfolio"
              onClick={close}
              className="flex flex-col gap-1 border-b border-border px-4 py-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10">
                    <WalletIcon />
                  </span>
                  <span className="text-base font-medium" dir="ltr">
                    {balance != null
                      ? `USD ${Number(balance).toLocaleString("en-US", { maximumFractionDigits: 2 })}`
                      : "—"}
                  </span>
                </div>
                <ChevronIcon open={false} />
              </div>
              <span className="text-xs text-muted">الرصيد المتاح</span>
            </Link>

            <button
              type="button"
              onClick={() => setCopyOpen((v) => !v)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-background"
            >
              <CandlestickIcon />
              <span className="flex-1 text-start">النسخ</span>
              <ChevronIcon open={copyOpen} />
            </button>
            {copyOpen && (
              <div className="flex flex-col gap-2 px-4 pb-2 pt-1">
                <Link
                  href={activeCopyProviderId ? `/trader/${activeCopyProviderId}` : "/discover"}
                  onClick={close}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">النسخ النشط</p>
                    <p className="truncate text-xs text-muted">
                      {activeCopyProviderId ? `تنسخ ${activeCopyProviderName ?? "متداول"}` : "لا تنسخ أحد"}
                    </p>
                  </div>
                  <ForwardArrowIcon />
                </Link>
                <Link
                  href="/portfolio#following"
                  onClick={close}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">المتابَعون</p>
                    <p className="truncate text-xs text-muted">
                      {followsCount && followsCount > 0 ? `تتابع ${followsCount} متداول` : "لا تتابع أحد"}
                    </p>
                  </div>
                  <ForwardArrowIcon />
                </Link>
              </div>
            )}
            {copyOpen && (
              <div className="flex flex-col pb-2">
                {TRADING_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={close}
                    className={
                      isActive(item.href)
                        ? "flex items-center gap-3 bg-accent/10 px-4 py-2.5 text-sm text-accent"
                        : "flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-background"
                    }
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className={isActive(item.href) ? "h-4 w-4 shrink-0" : "h-4 w-4 shrink-0 text-muted"}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      {item.icon}
                    </svg>
                    {item.label}
                  </Link>
                ))}
              </div>
            )}

            <div className="border-t border-border" />

            <SectionLabel>المدفوعات والمحفظة</SectionLabel>
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
