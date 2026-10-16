"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { Menu, X } from "lucide-react";
import { useNavDrawer } from "@/components/nav-drawer-context";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { MenuBody } from "@/components/MenuBody";

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
        aria-label={open ? t("menuCloseAriaLabel") : t("menuAriaLabel")}
        aria-expanded={open}
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded border border-border text-foreground"
      >
        {open ? <X className="h-5 w-5" strokeWidth={2} aria-hidden="true" /> : <Menu className="h-5 w-5" strokeWidth={2} aria-hidden="true" />}
      </button>

      {/* Full width, from under the top bar to the bottom of the screen; the top bar stays and the same button closes it. */}
      <div
        ref={panelRef}
        aria-hidden={!open}
        inert={!open}
        className={`fixed inset-x-0 top-14 bottom-0 z-10 scroll-subtle flex flex-col overflow-y-auto overscroll-contain bg-surface transition-opacity duration-200 sm:top-16 ${
          open ? "opacity-100" : "pointer-events-none invisible opacity-0"
        }`}
      >
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
