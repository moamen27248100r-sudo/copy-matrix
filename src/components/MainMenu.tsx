"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { logout } from "@/app/auth/actions";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useNavDrawer } from "@/components/nav-drawer-context";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import type { Locale } from "@/i18n/locales";

// neverActive: never highlight this entry as the current page (it can share
// a href with another entry).
type NavItem = { href: string; label: string; icon: ReactNode; neverActive?: boolean; badge?: "live" | "new" };

const ICONS = {
  markets: (
    <>
      <path d="M3 3v18h18" />
      <path d="M7 15l4-5 3 3 5-7" />
    </>
  ),
  history: (
    <>
      <path d="M9 3h6a2 2 0 0 1 2 2v14l-3-2-2 2-2-2-2 2-3-2V5a2 2 0 0 1 2-2z" />
      <path d="M9 8h6" />
      <path d="M9 12h6" />
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
  language: (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
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

// Masks the local part of an email for privacy: "delta126@gmail.com" -> "d****6@gmail.com".
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  if (local.length <= 2) return `${local[0]}****@${domain}`;
  return `${local[0]}****${local[local.length - 1]}@${domain}`;
}

const KYC_BADGE_TONE: Record<string, string> = {
  none: "border-warning/40 bg-warning/10 text-warning",
  pending: "border-warning/40 bg-warning/10 text-warning",
  approved: "border-success/40 bg-success/10 text-success",
  rejected: "border-danger/40 bg-danger/10 text-danger",
};

export function MainMenu({
  isAdmin,
  isLeadTrader = false,
  displayName,
  email,
  locale,
  kycStatus,
  kycStatusLabels,
}: {
  isAdmin: boolean;
  isLeadTrader?: boolean;
  displayName?: string | null;
  email?: string | null;
  locale: Locale;
  kycStatus: string;
  kycStatusLabels: { none: string; pending: string; approved: string; rejected: string };
}) {
  const t = useTranslations("Nav");
  const { open, toggle, close } = useNavDrawer("menu");
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const [hash, setHash] = useState("");
  const [search, setSearch] = useState("");

  useBodyScrollLock(open);

  // Swipe toward the panel's own edge (left in LTR, right in RTL) to close.
  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    const rtl = document.documentElement.dir === "rtl";
    if ((rtl && dx > 60) || (!rtl && dx < -60)) close();
  };

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

  // This is now a profile menu, not the primary navigation -- the main
  // sections (home/discover/my-copies/trades/portfolio) live in the
  // persistent bottom nav / sidebar instead.
  const items: NavItem[] = [
    { href: "/markets", label: t("menuMarkets"), icon: ICONS.markets },
    { href: "/portfolio?tab=activity", label: t("menuTransactionHistory"), icon: ICONS.history },
    { href: "/profit-share-history", label: t("menuProfitShareHistory"), icon: ICONS.history },
    { href: "/kyc", label: t("menuKyc"), icon: ICONS.kyc },
    isLeadTrader
      ? { href: "/lead", label: t("menuLeadCenter"), icon: ICONS.kyc }
      : { href: "/become-lead-trader", label: t("menuBecomeLeader"), icon: ICONS.kyc },
    { href: "/settings", label: t("menuSettings"), icon: ICONS.settings },
    { href: "/support", label: t("menuSupport"), icon: ICONS.support },
    ...(isAdmin ? [{ href: "/admin", label: t("menuAdmin"), icon: ADMIN_ICON }] : []),
  ];

  const isActive = (href: string) => {
    const [pathAndQuery, hashPart] = href.split("#");
    const [path, query] = pathAndQuery.split("?");
    if (path !== pathname) return false;
    if (hashPart) return hash === `#${hashPart}`;
    if (query) return search === query;
    return !hash && !search;
  };

  const kycLabel = (kycStatusLabels as Record<string, string>)[kycStatus] ?? kycStatusLabels.none;
  const kycTone = KYC_BADGE_TONE[kycStatus] ?? KYC_BADGE_TONE.none;

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-label={t("menuAriaLabel")}
        className="relative flex h-9 w-9 shrink-0 items-center justify-center"
      >
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br ${avatarGradient(email ?? displayName ?? "u")} text-sm font-bold text-white`}
        >
          {(displayName ?? email ?? "?").charAt(0).toUpperCase()}
        </span>
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
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className={
          open
            ? "fixed top-14 bottom-0 start-0 z-40 flex w-[78%] max-w-xs translate-x-0 flex-col overflow-y-auto border-e border-white/[0.06] bg-[#0B132B]/90 shadow-2xl shadow-black/50 backdrop-blur-xl transition-transform duration-300 ease-out sm:top-16"
            : "fixed top-14 bottom-0 start-0 z-40 flex w-[78%] max-w-xs -translate-x-full flex-col overflow-y-auto border-e border-white/[0.06] bg-[#0B132B]/90 shadow-2xl shadow-black/50 backdrop-blur-xl transition-transform duration-300 ease-out rtl:translate-x-full sm:top-16"
        }
      >
        {/* Account identity -- avatar with a live-status pulse dot, masked
            email, display name, and a KYC-status badge. */}
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
          <div className="min-w-0 flex-1 text-start">
            {displayName && <p className="truncate text-sm font-medium">{displayName}</p>}
            <p className="truncate text-xs text-muted" dir="ltr">
              {email ? maskEmail(email) : "—"}
            </p>
          </div>
          <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold ${kycTone}`}>
            {kycLabel}
          </span>
        </div>

        <SectionDivider />

        <div className="flex flex-col gap-0.5 px-2 py-2">
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
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {item.icon}
                  </svg>
                </span>
                <span className="flex-1">{item.label}</span>
              </Link>
            );
          })}

          {/* Language -- moved here from the header per the nav redesign. */}
          <div className="flex items-center justify-between gap-3 rounded-xl px-3 py-2">
            <span className="flex items-center gap-3 text-[15px] font-medium text-foreground/90">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/5 text-foreground/70">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {ICONS.language}
                </svg>
              </span>
              {t("langSectionLabel")}
            </span>
            <LanguageSwitcher currentLocale={locale} />
          </div>
        </div>

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
