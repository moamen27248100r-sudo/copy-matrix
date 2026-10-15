"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Copy,
  Crown,
  Headset,
  Lock,
  LogOut,
  Settings,
  ShieldHalf,
  UserPlus,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";
import { logout } from "@/app/auth/actions";
import { AccountTypeSwitcher } from "@/components/AccountTypeSwitcher";

// The account menu shared by the phone drawer and the desktop sidebar: who you are, the demo/real
// switch, the account and "more" links, the legal links, log out and the version.
// `compact` is the collapsed (icons only) form of the desktop sidebar.

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

type Item = { href: string; label: string; icon: LucideIcon };

function GroupTitle({ children }: { children: string }) {
  return <p className="px-3 pt-3 pb-1 text-xs font-bold uppercase tracking-wide text-muted">{children}</p>;
}

function Row({ item, active, compact, onNavigate }: { item: Item; active: boolean; compact: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={compact ? item.label : undefined}
      aria-label={compact ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={`flex items-center rounded-xl py-2 text-base transition ${compact ? "justify-center px-0" : "gap-3 px-3"} ${
        active ? "bg-accent/15 font-bold text-accent" : "font-medium text-muted hover:bg-white/5"
      }`}
    >
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${active ? "bg-accent/20 text-accent" : "bg-white/5 text-muted"}`}>
        <Icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
      </span>
      {!compact && (
        <>
          <span className="min-w-0 flex-1 leading-snug">{item.label}</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted rtl:rotate-180" aria-hidden="true" />
        </>
      )}
    </Link>
  );
}

export function MenuBody({
  isAdmin,
  isLeadTrader = false,
  accountNumber,
  displayName,
  email,
  kycStatus,
  accountType,
  compact = false,
  inSidebar = false,
  onNavigate,
}: {
  isAdmin: boolean;
  isLeadTrader?: boolean;
  accountNumber: number | string;
  displayName?: string | null;
  email?: string | null;
  kycStatus: string;
  accountType: "real" | "demo";
  compact?: boolean;
  /** The desktop sidebar (scrolls as a whole), not the phone drawer (footer pinned to the bottom). */
  inSidebar?: boolean;
  onNavigate?: () => void;
}) {
  const t = useTranslations("Nav");
  const tm = useTranslations("AccountMenu");
  const tDash = useTranslations("Dashboard");
  const pathname = usePathname();
  const accountDisplay = `#${accountNumber}`;
  const [copied, setCopied] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

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
      // Clipboard API unavailable or denied (insecure context, some WebViews): fall back below.
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

  const accountItems: Item[] = [
    { href: "/kyc", label: t("menuKyc"), icon: UserRoundCheck },
    { href: "/account/security", label: tm("security"), icon: Lock },
    { href: "/settings", label: t("menuSettings"), icon: Settings },
  ];
  const moreItems: Item[] = [
    isLeadTrader
      ? { href: "/lead", label: t("menuLeadCenter"), icon: Crown }
      : { href: "/become-lead-trader", label: t("menuBecomeLeader"), icon: Crown },
    ...(isLeadTrader ? [{ href: "/lead/followers", label: tm("inviteFriend"), icon: UserPlus }] : []),
    { href: "/support", label: t("menuSupport"), icon: Headset },
    ...(isAdmin ? [{ href: "/admin", label: t("menuAdmin"), icon: ShieldHalf }] : []),
  ];
  const legal = [
    { href: "/legal/terms", label: tm("terms") },
    { href: "/legal/privacy", label: tm("privacy") },
    { href: "/risk-disclosure", label: tm("riskDisclosure") },
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const kyc = KYC_BADGE[kycStatus] ?? KYC_BADGE.none;
  const initial = (displayName ?? email ?? "?").charAt(0).toUpperCase();
  const avatar = (
    <span
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${avatarGradient(email ?? displayName ?? "u")} text-base font-bold text-white`}
    >
      {initial}
    </span>
  );

  return (
    <>
      {compact ? (
        <div className="flex justify-center px-2 pt-3 pb-2" title={displayName ?? email ?? undefined}>
          {avatar}
        </div>
      ) : (
        <>
          {/* Account identity: avatar, name, masked email, UID with copy, KYC badge. */}
          <div className="flex items-start gap-3 px-4 pt-4 pb-3">
            {avatar}
            <div className="min-w-0 flex-1 text-start">
              {displayName && <p className="truncate text-sm font-bold">{displayName}</p>}
              <p className="truncate text-xs text-muted" dir="ltr">
                {email ? maskEmail(email) : "—"}
              </p>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                <span className="shrink-0">{tm("accountNumber")}</span>
                <span className="shrink-0 font-mono text-muted" dir="ltr" title={accountDisplay}>
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
              <span aria-live="polite" className={copied ? "mt-0.5 block text-xs font-medium text-success" : "sr-only"}>
                {copied ? tm("copied") : ""}
              </span>
              <Link
                href="/kyc"
                onClick={onNavigate}
                className={`mt-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold transition hover:opacity-80 ${kyc.tone}`}
              >
                {tm(kyc.key)}
                {kycStatus !== "approved" && <ChevronRight className="h-3 w-3 rtl:rotate-180" aria-hidden="true" />}
              </Link>
            </div>
          </div>

          <div className="px-4 pb-1">
            <AccountTypeSwitcher
              accountType={accountType}
              next={pathname || "/dashboard"}
              variant="pill"
              ariaLabel={t("switchAccountAriaLabel")}
              options={[
                { key: "real", label: tDash("accountTypeShortReal") },
                { key: "demo", label: tDash("accountTypeShortDemo") },
              ]}
              confirmTitle={t("switchAccountConfirmTitle")}
              confirmText={t("switchAccountWarning")}
              confirmCta={t("switchAccountConfirmCta")}
              cancelCta={t("switchAccountCancelCta")}
              onSwitch={onNavigate}
            />
            {accountType === "demo" && (
              <div className="mt-2 flex items-center gap-1 px-1 text-xs">
                <AccountTypeSwitcher
                  accountType="demo"
                  next={pathname || "/dashboard"}
                  variant="link"
                  linkLabel={t("demoStripSwitch")}
                  linkClassName="font-medium text-accent underline-offset-2 transition hover:underline"
                  ariaLabel={t("demoStripSwitch")}
                  options={[
                    { key: "real", label: tDash("accountTypeShortReal") },
                    { key: "demo", label: tDash("accountTypeShortDemo") },
                  ]}
                  confirmTitle={t("switchAccountConfirmTitle")}
                  confirmText={t("switchAccountWarning")}
                  confirmCta={t("switchAccountConfirmCta")}
                  cancelCta={t("switchAccountCancelCta")}
                  onSwitch={onNavigate}
                />
                <ArrowRight className="h-3 w-3 shrink-0 text-accent rtl:rotate-180" aria-hidden="true" />
              </div>
            )}
          </div>
        </>
      )}

      <div className="mx-3 my-2 h-px bg-white/[0.06]" aria-hidden="true" />

      <nav className={`flex flex-col ${compact ? "px-2" : "px-2"}`}>
        {!compact && <GroupTitle>{tm("groupAccount")}</GroupTitle>}
        {accountItems.map((item) => (
          <Row key={item.href} item={item} active={isActive(item.href)} compact={compact} onNavigate={onNavigate} />
        ))}
        {!compact && <GroupTitle>{tm("groupMore")}</GroupTitle>}
        {compact && <div className="mx-3 my-2 h-px bg-white/[0.06]" aria-hidden="true" />}
        {moreItems.map((item) => (
          <Row key={item.href} item={item} active={isActive(item.href)} compact={compact} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className={`${inSidebar ? "" : "sticky bottom-0"} mt-auto bg-[#0B132B]`}>
        <div className="mx-4 h-px bg-white/[0.06]" aria-hidden="true" />
        {!compact && (
          <p className="flex flex-wrap gap-x-3 gap-y-1 px-5 pt-3 text-xs text-muted">
            {legal.map((l) => (
              <Link key={l.href} href={l.href} onClick={onNavigate} className="transition hover:text-foreground">
                {l.label}
              </Link>
            ))}
          </p>
        )}
        <div className="px-2 py-2">
          <button
            type="button"
            onClick={() => setConfirmLogout(true)}
            title={compact ? t("logout") : undefined}
            aria-label={compact ? t("logout") : undefined}
            className={`flex w-full items-center rounded-xl py-2.5 text-base font-bold text-danger transition hover:bg-danger/10 ${compact ? "justify-center" : "gap-3 px-3"}`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-danger/10 text-danger">
              <LogOut className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            </span>
            {!compact && t("logout")}
          </button>
        </div>
      </div>

      {confirmLogout && (
        <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/70 p-4" onClick={() => setConfirmLogout(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-confirm-title"
            aria-describedby="logout-confirm-body"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-[20px] border border-white/10 bg-[#0B132B] p-5 shadow-2xl"
          >
            <h2 id="logout-confirm-title" className="text-section-title">
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
                <button type="submit" className="w-full rounded-xl bg-danger px-4 py-2.5 text-sm font-bold text-white transition hover:bg-danger/90">
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
