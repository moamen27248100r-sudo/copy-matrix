"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { logout, chooseAccountType } from "@/app/auth/actions";
import { ConfirmButton } from "@/components/ConfirmButton";
import { useNavDrawer } from "@/components/nav-drawer-context";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

type AccountType = "real" | "demo";

const ACCOUNT_TYPE_OPTIONS: { key: AccountType; label: string; dot: string }[] = [
  { key: "real", label: "الحساب الحقيقي", dot: "bg-success" },
  { key: "demo", label: "الحساب التجريبي", dot: "bg-accent" },
];

const SWITCH_WARNING =
  "التبديل بين الحساب الحقيقي والتجريبي يعيد ضبط الرصيد ويوقف النسخ الحالي. هل تريد المتابعة؟";

type NavItem = { href: string; label: string; icon: ReactNode };

// Every destination appears exactly once in this menu. The wallet balance
// card at the top is the entry to the portfolio overview, so there is no
// separate "overview" item; deposit and withdraw point at their own pages.
const MAIN_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "الرئيسية",
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
];

const ACTIVE_COPY_ICON = (
  <>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </>
);

const WALLET_ITEMS: NavItem[] = [
  {
    href: "/portfolio?tab=positions",
    label: "صفقاتي",
    icon: (
      <>
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </>
    ),
  },
  {
    href: "/portfolio?tab=activity",
    label: "سجل المعاملات",
    icon: (
      <>
        <path d="M9 3h6a2 2 0 0 1 2 2v14l-3-2-2 2-2-2-2 2-3-2V5a2 2 0 0 1 2-2z" />
        <path d="M9 8h6" />
        <path d="M9 12h6" />
      </>
    ),
  },
  {
    href: "/portfolio/deposit",
    label: "إيداع",
    icon: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12l7 7 7-7" />
      </>
    ),
  },
  {
    href: "/portfolio/withdraw",
    label: "سحب",
    icon: (
      <>
        <path d="M12 19V5" />
        <path d="M5 12l7-7 7 7" />
      </>
    ),
  },
];

const ACCOUNT_ITEMS: NavItem[] = [
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
  {
    href: "/support",
    label: "مركز الدعم",
    icon: (
      <>
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="4" />
        <line x1="4.93" y1="4.93" x2="9.17" y2="9.17" />
        <line x1="14.83" y1="14.83" x2="19.07" y2="19.07" />
        <line x1="14.83" y1="9.17" x2="19.07" y2="4.93" />
        <line x1="4.93" y1="19.07" x2="9.17" y2="14.83" />
      </>
    ),
  },
];

const ADMIN_ITEM: NavItem = {
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

function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-success" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M9 12l2 2 4-4" />
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

export function MainMenu({
  balance,
  isAdmin,
  displayName,
  email,
  accountType,
  activeCopyProviderId,
}: {
  balance: number | null;
  isAdmin: boolean;
  displayName?: string | null;
  email?: string | null;
  accountType?: AccountType | null;
  activeCopyProviderId?: string | null;
}) {
  const { open, toggle, close } = useNavDrawer("menu");
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const [accountSwitcherOpen, setAccountSwitcherOpen] = useState(false);
  const [hash, setHash] = useState("");
  const [search, setSearch] = useState("");

  useBodyScrollLock(open);

  // The panel can otherwise open already scrolled a few hundred pixels down
  // (the browser's scroll-anchoring kicking in during the slide-in
  // transition) instead of showing its content from the top.
  useEffect(() => {
    if (open && panelRef.current) panelRef.current.scrollTop = 0;
  }, [open]);

  useEffect(() => {
    setHash(window.location.hash);
    setSearch(window.location.search.replace(/^\?/, ""));
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [pathname]);

  const mainItems: NavItem[] = activeCopyProviderId
    ? [
        MAIN_ITEMS[0],
        { href: `/trader/${activeCopyProviderId}`, label: "النسخ النشط", icon: ACTIVE_COPY_ICON },
        ...MAIN_ITEMS.slice(1),
      ]
    : MAIN_ITEMS;
  const accountItems = isAdmin ? [...ACCOUNT_ITEMS, ADMIN_ITEM] : ACCOUNT_ITEMS;
  const currentAccount = ACCOUNT_TYPE_OPTIONS.find((o) => o.key === accountType);

  const isActive = (href: string) => {
    const [pathAndQuery, hashPart] = href.split("#");
    const [path, query] = pathAndQuery.split("?");
    if (path !== pathname) return false;
    if (hashPart) return hash === `#${hashPart}`;
    if (query) return search === query;
    return !hash && !search;
  };

  const renderItems = (items: NavItem[]) => (
    <div className="flex flex-col pb-1">
      {items.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={close}
            className={
              active
                ? "flex items-center gap-3 bg-accent/10 px-4 py-2.5 text-sm text-accent"
                : "flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-background"
            }
          >
            <svg
              viewBox="0 0 24 24"
              className={active ? "h-4 w-4 shrink-0" : "h-4 w-4 shrink-0 text-muted"}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {item.icon}
            </svg>
            <span className="flex-1">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );

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
        <button
          type="button"
          onClick={() => setAccountSwitcherOpen((v) => !v)}
          aria-label="تبديل نوع الحساب"
          className="flex w-full items-center justify-between gap-2 border-b border-border px-4 py-3"
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background text-muted">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c0-4 3.5-7 8-7s8 3 8 7" />
              </svg>
            </span>
            <div className="min-w-0 text-start">
              <p className="truncate text-sm font-medium" dir="ltr">
                {email ? maskEmail(email) : "—"}
              </p>
              {currentAccount && (
                <p className="flex items-center gap-1.5 text-xs text-muted">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${currentAccount.dot}`} aria-hidden="true" />
                  {currentAccount.label}
                </p>
              )}
            </div>
          </div>
          <ChevronIcon open={accountSwitcherOpen} />
        </button>

        {accountSwitcherOpen && (
          <div className="flex flex-col border-b border-border">
            {ACCOUNT_TYPE_OPTIONS.map((opt) =>
              accountType === opt.key ? (
                <div key={opt.key} className="flex items-center gap-3 bg-background/60 px-4 py-3 text-sm">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${opt.dot}`} aria-hidden="true" />
                  <span className="flex-1 font-medium">{opt.label}</span>
                  <CheckCircleIcon />
                </div>
              ) : (
                <form key={opt.key} action={chooseAccountType}>
                  <input type="hidden" name="accountType" value={opt.key} />
                  <input type="hidden" name="next" value={pathname} />
                  <ConfirmButton
                    confirmText={SWITCH_WARNING}
                    className="flex w-full items-center gap-3 px-4 py-3 text-sm text-muted transition hover:bg-background hover:text-foreground"
                  >
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${opt.dot} opacity-40`} aria-hidden="true" />
                    <span className="flex-1 text-start">{opt.label}</span>
                  </ConfirmButton>
                </form>
              ),
            )}
          </div>
        )}

        <Link
          href="/portfolio"
          onClick={close}
          className="flex flex-col gap-1 border-b border-border px-4 py-4 hover:bg-background"
        >
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
          <span className="text-xs text-muted">الرصيد المتاح · افتح المحفظة</span>
        </Link>

        <div className="pt-2">{renderItems(mainItems)}</div>

        <div className="border-t border-border" />
        <SectionLabel>المحفظة</SectionLabel>
        {renderItems(WALLET_ITEMS)}

        <div className="border-t border-border" />
        <SectionLabel>الحساب</SectionLabel>
        {renderItems(accountItems)}

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
