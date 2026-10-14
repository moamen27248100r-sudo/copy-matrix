"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { Menu, X } from "lucide-react";
import { useNavDrawer } from "@/components/nav-drawer-context";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { MenuBody } from "@/components/MenuBody";
import { Logo } from "@/components/Logo";

// The phone menu: a panel the full height of the screen, from the top edge to the bottom edge.
// (On a desktop screen the same content lives in the fixed sidebar -- see SidebarNav.)
export function MainMenu({
  isAdmin,
  isLeadTrader = false,
  accountNumber,
  displayName,
  email,
  kycStatus,
  accountType,
}: {
  isAdmin: boolean;
  isLeadTrader?: boolean;
  accountNumber: number | string;
  displayName?: string | null;
  email?: string | null;
  kycStatus: string;
  accountType: "real" | "demo";
}) {
  const t = useTranslations("Nav");
  const { open, toggle, close } = useNavDrawer("menu");
  const panelRef = useRef<HTMLDivElement>(null);

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

  // The panel can otherwise open already scrolled a few hundred pixels down.
  useEffect(() => {
    if (open && panelRef.current) panelRef.current.scrollTop = 0;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={toggle}
        aria-label={t("menuAriaLabel")}
        aria-expanded={open}
        className="relative flex h-9 w-9 shrink-0 items-center justify-center"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded border border-border text-foreground">
          <Menu className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
        </span>
      </button>

      <div
        className={
          open
            ? "fixed inset-0 z-[10000] bg-black/60 backdrop-blur-[2px] transition-opacity duration-300"
            : "pointer-events-none fixed inset-0 z-[10000] bg-black/60 opacity-0 transition-opacity duration-300"
        }
        onClick={close}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        aria-hidden={!open}
        className={`fixed inset-y-0 start-0 z-[10001] flex w-[86%] max-w-xs scroll-subtle flex-col overflow-y-auto overscroll-contain border-e border-white/[0.06] bg-[#0B132B] shadow-2xl shadow-black/50 transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full rtl:translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-1">
          <Logo iconClassName="h-4 w-4" textClassName="text-base" />
          <button
            type="button"
            onClick={close}
            aria-label={t("menuCloseAriaLabel")}
            className="flex h-9 w-9 items-center justify-center rounded border border-border text-foreground"
          >
            <X className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        <MenuBody
          isAdmin={isAdmin}
          isLeadTrader={isLeadTrader}
          accountNumber={accountNumber}
          displayName={displayName}
          email={email}
          kycStatus={kycStatus}
          accountType={accountType}
          onNavigate={close}
        />
      </div>
    </div>
  );
}
