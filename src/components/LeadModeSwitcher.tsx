"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

// Shown in the header only for accounts approved as a lead trader (Phase 1).
// Plain navigation between the copier dashboard and the lead trader center --
// no account mutation, so no confirm dialog is needed (unlike
// AccountTypeSwitcher, which does change money-relevant state).
export function LeadModeSwitcher() {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const inLeaderMode = pathname?.startsWith("/lead") ?? false;
  return (
    <Link
      href={inLeaderMode ? "/dashboard" : "/lead"}
      className="hidden shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-accent/40 sm:flex"
    >
      {inLeaderMode ? t("switchToCopierMode") : t("switchToLeaderMode")}
    </Link>
  );
}
