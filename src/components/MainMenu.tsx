"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Check,
  ChevronRight,
  Copy,
  Crown,
  FileText,
  Headset,
  Languages,
  LineChart,
  Lock,
  LogOut,
  PieChart,
  ReceiptText,
  Settings,
  ShieldCheck,
  ShieldHalf,
  UserPlus,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";
import { logout } from "@/app/auth/actions";
import { setLocale } from "@/app/actions/locale";
import { useNavDrawer } from "@/components/nav-drawer-context";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import type { Locale } from "@/i18n/locales";

type NavItem = { href: string; label: string; icon: LucideIcon };
type NavGroup = { title: string; items: NavItem[] };

// Native language names: shown as-is in every UI language.
const LOCALE_LABELS: Partial<Record<Locale, string>> = { ar: "العربية", en: "English" };
// Same set the header switcher offers.
const MENU_LOCALES: Locale[] = ["ar", "en"];

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

// Masks the local part of an email for privacy: "delta126@gmail.com" -> "d****6@gmail.com".
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  if (local.length <= 2) return `${local[0]}****@${domain}`;
  return `${local[0]}****${local[local.length - 1]}@${domain}`;
}

const KYC_BADGE: Record<string, { tone: string; key: "kycVerified" | "kycUnverified" | "kycPending" | "kycRejected" }> = {
  none: { tone: "border-warning/40 bg-warning/10 text-warning", key: "kycUnverified" },
  pending: { tone: "border-warning/40 bg-warning/10 text-warning", key: "kycPending" },
  approved: { tone: "border-success/40 bg-success/10 text-success", key: "kycVerified" },
  rejected: { tone: "border-danger/40 bg-danger/10 text-danger", key: "kycRejected" },
};

function GroupTitle({ children }: { children: string }) {
  return <p className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{children}</p>;
}

function RowIcon({ icon: Icon, tone = "bg-white/5 text-foreground/70" }: { icon: LucideIcon; tone?: string }) {
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${tone}`}>
      <Icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
    </span>
  );
}

function Chevron() {
  return <ChevronRight className="h-4 w-4 shrink-0 text-muted rtl:rotate-180" aria-hidden="true" />;
}

export function MainMenu({
  isAdmin,
  isLeadTrader = false,
  accountNumber,
  displayName,
  email,
  locale,
  kycStatus,
}: {
  isAdmin: boolean;
  isLeadTrader?: boolean;
  accountNumber: number | string;
  displayName?: string | null;
  email?: string | null;
  locale: Locale;
  kycStatus: string;
}) {
  const t = useTranslations("Nav");
  const tm = useTranslations("AccountMenu");
  const { open, toggle, close } = useNavDrawer("menu");
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const accountDisplay = `#${accountNumber}`;
  const [copied, setCopied] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

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
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(id);
  }, [copied]);

  async function copyUid() {
    try {
      await navigator.clipboard.writeText(accountDisplay);
      setCopied(true);
      return;
    } catch {
      // Clipboard API unavailable or denied (insecure context, some
      // WebViews): fall back to a hidden textarea + execCommand.
    }
    const ta = document.createElement("textarea");
    ta.value = accountDisplay;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    if (ok) setCopied(true);
  }

  // A profile menu, not the primary navigation -- the main sections live in
  // the persistent bottom nav / sidebar.
  const groups: NavGroup[] = [
    {
      title: tm("groupAccount"),
      items: [
        { href: "/kyc", label: t("menuKyc"), icon: UserRoundCheck },
        { href: "/account/security", label: tm("security"), icon: Lock },
        { href: "/notifications/preferences", label: tm("notifications"), icon: Bell },
        { href: "/settings", label: t("menuSettings"), icon: Settings },
      ],
    },
    {
      title: tm("groupMoney"),
      items: [
        { href: "/portfolio?tab=activity", label: t("menuTransactionHistory"), icon: ReceiptText },
        { href: "/profit-share-history", label: t("menuProfitShareHistory"), icon: PieChart },
      ],
    },
    {
      title: tm("groupMore"),
      items: [
        isLeadTrader
          ? { href: "/lead", label: t("menuLeadCenter"), icon: Crown }
          : { href: "/become-lead-trader", label: t("menuBecomeLeader"), icon: Crown },
        // Invites exist only for lead traders (follower invite links); there
        // is no referral program for regular users, so they don't see it.
        ...(isLeadTrader ? [{ href: "/lead/followers", label: tm("inviteFriend"), icon: UserPlus }] : []),
        { href: "/markets", label: t("menuMarkets"), icon: LineChart },
        ...(isAdmin ? [{ href: "/admin", label: t("menuAdmin"), icon: ShieldHalf }] : []),
      ],
    },
    {
      title: tm("groupSupport"),
      items: [
        { href: "/support", label: t("menuSupport"), icon: Headset },
        { href: "/legal/terms", label: tm("terms"), icon: FileText },
        { href: "/legal/privacy", label: tm("privacy"), icon: ShieldCheck },
        { href: "/risk-disclosure", label: tm("riskDisclosure"), icon: AlertTriangle },
      ],
    },
  ];

  const isActive = (href: string) => href.split("?")[0] === pathname;
  const kyc = KYC_BADGE[kycStatus] ?? KYC_BADGE.none;
  const version = process.env.NEXT_PUBLIC_APP_VERSION;

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
            ? "fixed top-14 bottom-0 start-0 z-40 flex w-[82%] max-w-xs translate-x-0 scroll-subtle flex-col overflow-y-auto overscroll-contain border-e border-white/[0.06] bg-[#0B132B]/95 shadow-2xl shadow-black/50 backdrop-blur-xl transition-transform duration-300 ease-out sm:top-16"
            : "fixed top-14 bottom-0 start-0 z-40 flex w-[82%] max-w-xs -translate-x-full scroll-subtle flex-col overflow-y-auto overscroll-contain border-e border-white/[0.06] bg-[#0B132B]/95 shadow-2xl shadow-black/50 backdrop-blur-xl transition-transform duration-300 ease-out rtl:translate-x-full sm:top-16"
        }
      >
        {/* Account identity: avatar, name, masked email, UID with copy,
            and the KYC status badge (links to identity verification). */}
        <div className="flex items-start gap-3 px-4 pt-4 pb-3">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${avatarGradient(email ?? displayName ?? "u")} text-base font-bold text-white`}
          >
            {(displayName ?? email ?? "?").charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1 text-start">
            {displayName && <p className="truncate text-sm font-semibold">{displayName}</p>}
            <p className="truncate text-xs text-muted" dir="ltr">
              {email ? maskEmail(email) : "—"}
            </p>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
              <span className="shrink-0">{tm("accountNumber")}</span>
              <span className="min-w-0 truncate font-mono text-foreground/80" dir="ltr" title={accountDisplay}>
                {accountDisplay}
              </span>
              <button
                type="button"
                onClick={copyUid}
                aria-label={tm("copyUid")}
                title={tm("copyUid")}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-white/10 hover:text-foreground"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
              </button>
            </div>
            <span aria-live="polite" className={copied ? "mt-0.5 block text-[11px] font-medium text-success" : "sr-only"}>
              {copied ? tm("copied") : ""}
            </span>
            <Link
              href="/kyc"
              onClick={close}
              className={`mt-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition hover:opacity-80 ${kyc.tone}`}
            >
              {tm(kyc.key)}
              {kycStatus !== "approved" && <ChevronRight className="h-3 w-3 rtl:rotate-180" aria-hidden="true" />}
            </Link>
          </div>
        </div>

        <div className="mx-4 h-px bg-white/[0.06]" aria-hidden="true" />

        <nav className="flex flex-col px-2 pb-2">
          {groups.map((group) => (
            <div key={group.title} className="flex flex-col">
              <GroupTitle>{group.title}</GroupTitle>
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={close}
                    aria-current={active ? "page" : undefined}
                    className={
                      active
                        ? "flex items-center gap-3 rounded-xl bg-accent/15 px-3 py-2 text-[15px] font-semibold text-accent"
                        : "flex items-center gap-3 rounded-xl px-3 py-2 text-[15px] font-medium text-foreground/90 transition hover:bg-white/5"
                    }
                  >
                    <RowIcon icon={item.icon} tone={active ? "bg-accent/20 text-accent" : undefined} />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    <Chevron />
                  </Link>
                );
              })}
            </div>
          ))}

          <GroupTitle>{tm("groupLanguage")}</GroupTitle>
          <button
            type="button"
            onClick={() => setLangOpen((v) => !v)}
            aria-expanded={langOpen}
            className="flex items-center gap-3 rounded-xl px-3 py-2 text-[15px] font-medium text-foreground/90 transition hover:bg-white/5"
          >
            <RowIcon icon={Languages} />
            <span className="min-w-0 flex-1 truncate text-start">{LOCALE_LABELS[locale] ?? locale.toUpperCase()}</span>
            <ChevronRight className={`h-4 w-4 shrink-0 text-muted transition-transform ${langOpen ? "rotate-90" : "rtl:rotate-180"}`} aria-hidden="true" />
          </button>
          {langOpen && (
            <div className="ms-11 flex flex-col gap-0.5 pb-1">
              {MENU_LOCALES.map((l) => (
                <form key={l} action={setLocale}>
                  <input type="hidden" name="locale" value={l} />
                  <input type="hidden" name="path" value={pathname ?? "/"} />
                  <button
                    type="submit"
                    className={
                      l === locale
                        ? "flex w-full items-center justify-between rounded-lg bg-accent/10 px-3 py-2 text-sm font-medium text-accent"
                        : "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-foreground/90 hover:bg-white/5"
                    }
                  >
                    {LOCALE_LABELS[l]}
                    {l === locale && <Check className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </form>
              ))}
            </div>
          )}
        </nav>

        <div className="mt-auto">
          <div className="mx-4 h-px bg-white/[0.06]" aria-hidden="true" />
          <div className="px-2 py-2">
            <button
              type="button"
              onClick={() => setConfirmLogout(true)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold text-danger transition hover:bg-danger/10"
            >
              <RowIcon icon={LogOut} tone="bg-danger/10 text-danger" />
              {t("logout")}
            </button>
          </div>
          {version && <p className="pb-4 text-center text-[11px] text-muted/70">{tm("version", { version })}</p>}
        </div>
      </div>

      {confirmLogout && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setConfirmLogout(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="logout-confirm-title"
            aria-describedby="logout-confirm-body"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0B132B] p-5 shadow-2xl"
          >
            <h2 id="logout-confirm-title" className="text-lg font-semibold">
              {tm("logoutConfirmTitle")}
            </h2>
            <p id="logout-confirm-body" className="mt-2 text-sm text-muted">
              {tm("logoutConfirmBody")}
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => setConfirmLogout(false)}
                className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition hover:bg-white/5"
              >
                {tm("cancel")}
              </button>
              <form action={logout} className="flex-1">
                <button
                  type="submit"
                  className="w-full rounded-xl bg-danger px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-danger/90"
                >
                  {t("logout")}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
