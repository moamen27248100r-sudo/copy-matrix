"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

const TABS = [
  { href: "/lead", key: "overview" },
  { href: "/lead/performance", key: "performance" },
  { href: "/lead/trades", key: "trades" },
  { href: "/lead/followers", key: "followers" },
  { href: "/lead/settlements", key: "settlements" },
  { href: "/lead/tasks", key: "tasks" },
  { href: "/lead/settings", key: "settings" },
] as const;

export function LeadCenterNav() {
  const t = useTranslations("LeadTrader.nav");
  const pathname = usePathname();
  return (
    <nav className="-mx-6 flex gap-1 overflow-x-auto border-b border-border px-6 pb-2 sm:mx-0 sm:px-0">
      {TABS.map((tab) => {
        const active = tab.href === "/lead" ? pathname === "/lead" : pathname?.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              active
                ? "shrink-0 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground"
                : "shrink-0 rounded-lg px-3 py-2 text-sm text-muted transition hover:text-foreground"
            }
          >
            {t(tab.key)}
          </Link>
        );
      })}
    </nav>
  );
}
