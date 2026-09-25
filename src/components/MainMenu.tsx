"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { logout, chooseAccountType } from "@/app/auth/actions";
import { ConfirmButton } from "@/components/ConfirmButton";
import { useNavDrawer } from "@/components/nav-drawer-context";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

type AccountType = "real" | "demo";

// neverActive: never highlight this entry as the current page (it can share
// a href with another entry).
type NavItem = { href: string; label: string; icon: ReactNode; neverActive?: boolean; badge?: "live" | "new" };

const MAIN_ICONS = {
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
  markets: (
    <>
      <path d="M3 3v18h18" />
      <path d="M7 15l4-5 3 3 5-7" />
    </>
  ),
};

const ACTIVE_COPY_ICON = (
  <>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </>
);

const WALLET_ICONS = {
  myTrades: (
    <>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </>
  ),
  history: (
    <>
      <path d="M9 3h6a2 2 0 0 1 2 2v14l-3-2-2 2-2-2-2 2-3-2V5a2 2 0 0 1 2-2z" />
      <path d="M9 8h6" />
      <path d="M9 12h6" />
    </>
  ),
  deposit: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12l7 7 7-7" />
    </>
  ),
  withdraw: (
    <>
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </>
  ),
};

const ACCOUNT_ICONS = {
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
};

const ADMIN_ICON = (
  <>
    <path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" />
  </>
);

const AVATAR_GRADIENTS = [
  "from-accent to-brand",
  "from-emerald-400 to-teal-600",
  "from-violet-400 to-indigo-600",
  "from-amber-400 to-orange-600",
];

function avatarGradient(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

function SectionLabel({ children }: { children: string }) {
  return <p className="px-4 pt-5 pb-1.5 text-xs font-semibold uppercase tracking-wide text-muted/70">{children}</p>;
}

// Thin fading gradient line instead of a flat solid border -- reads
// softer against the glass panel background than a hard edge-to-edge rule.
function SectionDivider() {
  return <div className="mx-4 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" aria-hidden="true" />;
}

function LiveDot() {
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
    </span>
  );
}

function NewBadge({ text }: { text: string }) {
  return (
    <span className="shrink-0 rounded-full bg-gradient-to-r from-accent to-brand px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
      {text}
    </span>
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
  const t = useTranslations("Nav");
  const { open, toggle, close } = useNavDrawer("menu");
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
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

  const accountTypeOptions: { key: AccountType; label: string }[] = [
    { key: "demo", label: t("accountTypeDemo") },
    { key: "real", label: t("accountTypeReal") },
  ];

  // Always present: opens the leader being copied, or -- with no active
  // copy -- sends the customer to browse leaders so they can start one.
  const mainItems: NavItem[] = [
    { href: "/dashboard", label: t("menuMain"), icon: MAIN_ICONS.home },
    {
      href: activeCopyProviderId ? `/trader/${activeCopyProviderId}` : "/discover",
      label: t("menuActiveCopy"),
      icon: ACTIVE_COPY_ICON,
      neverActive: !activeCopyProviderId,
      badge: activeCopyProviderId ? "live" : undefined,
    },
    { href: "/discover", label: t("menuDiscover"), icon: MAIN_ICONS.discover, badge: "new" },
    { href: "/markets", label: t("menuMarkets"), icon: MAIN_ICONS.markets },
  ];
  const walletItems: NavItem[] = [
    { href: "/portfolio?tab=positions", label: t("menuMyTrades"), icon: WALLET_ICONS.myTrades },
    { href: "/portfolio?tab=activity", label: t("menuTransactionHistory"), icon: WALLET_ICONS.history },
  ];
  const baseAccountItems: NavItem[] = [
    { href: "/kyc", label: t("menuKyc"), icon: ACCOUNT_ICONS.kyc },
    { href: "/settings", label: t("menuSettings"), icon: ACCOUNT_ICONS.settings },
    { href: "/support", label: t("menuSupport"), icon: ACCOUNT_ICONS.support },
  ];
  const accountItems = isAdmin
    ? [...baseAccountItems, { href: "/admin", label: t("menuAdmin"), icon: ADMIN_ICON }]
    : baseAccountItems;

  const isActive = (href: string) => {
    const [pathAndQuery, hashPart] = href.split("#");
    const [path, query] = pathAndQuery.split("?");
    if (path !== pathname) return false;
    if (hashPart) return hash === `#${hashPart}`;
    if (query) return search === query;
    return !hash && !search;
  };

  const renderItems = (items: NavItem[]) => (
    <div className="flex flex-col gap-0.5 px-2 pb-1">
      {items.map((item) => {
        const active = !item.neverActive && isActive(item.href);
        return (
          <Link
            key={item.label}
            href={item.href}
            onClick={close}
            className={
              active
                ? "relative flex items-center gap-3 overflow-hidden rounded-xl bg-gradient-to-r from-accent/25 to-brand/10 px-3 py-2 text-[15px] font-semibold text-accent"
                : "relative flex items-center gap-3 rounded-xl px-3 py-2 text-[15px] font-medium text-foreground/90 transition hover:bg-white/5"
            }
          >
            {active && (
              <span className="absolute inset-y-1 start-0 w-[3px] rounded-full bg-gradient-to-b from-accent to-brand shadow-[0_0_8px_theme(colors.accent)]" aria-hidden="true" />
            )}
            <span
              className={
                active
                  ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent/20 text-accent shadow-[0_0_10px_rgba(56,189,248,0.35)]"
                  : "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/5 text-foreground/70"
              }
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {item.icon}
              </svg>
            </span>
            <span className="flex-1">{item.label}</span>
            {item.badge === "live" && <LiveDot />}
            {item.badge === "new" && <NewBadge text={t("badgeNew")} />}
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
        aria-label={t("menuAriaLabel")}
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
            ? "fixed inset-x-0 top-14 bottom-0 z-40 bg-black/60 backdrop-blur-[2px] transition-opacity duration-300 sm:top-16"
            : "fixed inset-x-0 top-14 bottom-0 z-40 bg-black/60 opacity-0 pointer-events-none transition-opacity duration-300 sm:top-16"
        }
        onClick={close}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        className={
          open
            ? "fixed top-14 bottom-0 right-0 z-40 flex w-[78%] max-w-xs translate-x-0 flex-col overflow-y-auto border-s border-white/[0.06] bg-[#0B132B]/90 shadow-2xl shadow-black/50 backdrop-blur-xl transition-transform duration-300 ease-out sm:top-16"
            : "fixed top-14 bottom-0 right-0 z-40 flex w-[78%] max-w-xs translate-x-full flex-col overflow-y-auto border-s border-white/[0.06] bg-[#0B132B]/90 shadow-2xl shadow-black/50 backdrop-blur-xl transition-transform duration-300 ease-out sm:top-16"
        }
      >
        {/* Account identity -- avatar with a live-status pulse dot */}
        <div className="flex items-center gap-3 px-4 py-4">
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center">
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${avatarGradient(email ?? displayName ?? "u")} text-sm font-bold text-white`}
            >
              {(displayName ?? email ?? "?").charAt(0).toUpperCase()}
            </span>
            <span className="absolute -end-0.5 -bottom-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#0B132B]">
              <LiveDot />
            </span>
          </span>
          <div className="min-w-0 text-start">
            <p className="truncate text-sm font-medium" dir="ltr">
              {email ? maskEmail(email) : "—"}
            </p>
            {displayName && <p className="truncate text-xs text-muted">{displayName}</p>}
          </div>
        </div>

        <SectionDivider />

        {/* Balance widget -- glass gradient card with an inline account-type
            switch and a quick-deposit shortcut, both right where the
            customer is already looking at their money. */}
        <div className="mx-4 mt-3 flex flex-col gap-3 rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-600/20 to-indigo-600/20 p-4">
          <div className="flex items-center justify-between gap-2">
            <Link href="/portfolio" onClick={close} className="min-w-0">
              <p className="text-xl font-bold text-foreground" dir="ltr">
                {balance != null
                  ? `USD ${Number(balance).toLocaleString("en-US", { maximumFractionDigits: 2 })}`
                  : "—"}
              </p>
              <p className="text-xs text-muted">{t("availableBalance")}</p>
            </Link>
            <Link
              href="/portfolio/deposit"
              onClick={close}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-900/30 transition active:scale-95"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 5v14" />
                <path d="M5 12l7 7 7-7" />
              </svg>
              {t("menuDeposit")}
            </Link>
          </div>

          {accountType && (
            <div className="flex rounded-full bg-black/25 p-1">
              {accountTypeOptions.map((opt) =>
                accountType === opt.key ? (
                  <span
                    key={opt.key}
                    className="flex-1 rounded-full bg-white/10 px-3 py-1.5 text-center text-xs font-semibold text-foreground"
                  >
                    {opt.label}
                  </span>
                ) : (
                  <form key={opt.key} action={chooseAccountType} className="flex-1">
                    <input type="hidden" name="accountType" value={opt.key} />
                    <input type="hidden" name="next" value={pathname} />
                    <ConfirmButton
                      confirmText={t("switchAccountWarning")}
                      className="w-full rounded-full px-3 py-1.5 text-center text-xs font-medium text-muted transition hover:text-foreground"
                    >
                      {opt.label}
                    </ConfirmButton>
                  </form>
                ),
              )}
            </div>
          )}
        </div>

        {/* Quick action grid -- deposit / withdraw as two glass buttons
            side by side instead of buried in a plain list row. */}
        <div className="mx-4 mt-3 grid grid-cols-2 gap-2">
          <Link
            href="/portfolio/deposit"
            onClick={close}
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-emerald-500/25 bg-gradient-to-b from-emerald-500/15 to-emerald-600/5 py-3 text-emerald-300 transition active:scale-95"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {WALLET_ICONS.deposit}
            </svg>
            <span className="text-xs font-semibold">{t("menuDeposit")}</span>
          </Link>
          <Link
            href="/portfolio/withdraw"
            onClick={close}
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/[0.08] bg-white/[0.04] py-3 text-foreground/80 transition active:scale-95"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {WALLET_ICONS.withdraw}
            </svg>
            <span className="text-xs font-semibold">{t("menuWithdraw")}</span>
          </Link>
        </div>

        <div className="pt-3">{renderItems(mainItems)}</div>

        <SectionDivider />
        <SectionLabel>{t("walletSectionLabel")}</SectionLabel>
        {renderItems(walletItems)}

        <SectionDivider />
        <SectionLabel>{t("accountSectionLabel")}</SectionLabel>
        {renderItems(accountItems)}

        <div className="mt-auto">
          <SectionDivider />
          <form action={logout} className="px-2 py-2">
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium text-danger transition hover:bg-danger/10"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-danger/10">
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <path d="M16 17l5-5-5-5" />
                  <path d="M21 12H9" />
                </svg>
              </span>
              {t("logout")}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
