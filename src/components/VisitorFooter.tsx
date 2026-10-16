"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { FOOTER_SECTIONS } from "@/lib/footer-links";

// The footer of every page a visitor sees: the logo and a short line about the product, link groups,
// and the risk warning with who we are. On a phone each group is an accordion (a + that turns into
// a x, one open at a time); from 1024px up the groups sit open in columns. Nothing here quotes user,
// country or money figures.
export function VisitorFooter() {
  const t = useTranslations("VisitorFooter");
  const ts = useTranslations("SiteFooter");
  const [open, setOpen] = useState<string | null>(null);
  const baseId = useId();

  return (
    <footer className="border-t border-glass-border px-4 pb-24 pt-10 md:px-6 lg:pb-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div className="flex flex-col gap-3">
          <Logo iconClassName="h-5 w-5" textClassName="text-lg" />
          <p className="max-w-md text-sm leading-relaxed text-muted">{t("intro")}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 lg:gap-8">
          {FOOTER_SECTIONS.map((section) => {
            const isOpen = open === section.key;
            const panelId = `${baseId}-${section.key}`;
            return (
              <div key={section.key} className="border-b border-glass-border lg:border-b-0">
                <h3 className="hidden pb-3 text-sm font-bold lg:block">{t(section.key)}</h3>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpen(isOpen ? null : section.key)}
                  className="flex min-h-12 w-full items-center justify-between gap-3 py-3 text-start text-sm font-bold lg:hidden"
                >
                  {t(section.key)}
                  {isOpen ? <X className="h-4 w-4 shrink-0" aria-hidden="true" /> : <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />}
                </button>
                <ul id={panelId} className={`${isOpen ? "flex" : "hidden"} flex-col gap-1 pb-4 lg:flex lg:pb-0`}>
                  {section.links.map((l) => (
                    <li key={l.key + l.href}>
                      <Link href={l.href} className="tap-44 inline-flex items-center py-1.5 text-sm text-muted transition hover:text-foreground">
                        {t(l.key)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-2 border-t border-glass-border pt-6 text-xs leading-relaxed text-muted">
          <p>{t("riskWarning")}</p>
          <p>{t("notBroker")}</p>
          <p>
            © {new Date().getFullYear()} <span translate="no">Copy Matrix</span>. {ts("rights")}
          </p>
        </div>
      </div>
    </footer>
  );
}
