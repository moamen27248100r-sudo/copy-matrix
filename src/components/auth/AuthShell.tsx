import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/Logo";
import type { ReactNode } from "react";

// Shared frame for the login / sign-up pages: landing design tokens, logo,
// a link back to the home page and a centred 420px column.
export async function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const t = await getTranslations("Auth");
  return (
    <div className="landing min-h-screen">
      <header className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="Copy Matrix">
          <Logo iconClassName="h-4 w-4" textClassName="text-lg" />
        </Link>
        <Link href="/" className="flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground">
          {t("backHome")}
          <ArrowRight className="h-4 w-4 rtl:rotate-180" strokeWidth={1.5} aria-hidden="true" />
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-[420px] flex-col gap-6 px-4 pb-16 pt-8 sm:px-0 sm:pt-14">
        <div className="flex flex-col gap-2">
          <h1 className="text-[28px] font-semibold leading-9">{title}</h1>
          {subtitle && <p className="text-base leading-7 text-muted">{subtitle}</p>}
        </div>
        {children}
      </main>
    </div>
  );
}

export const inputClass =
  "w-full rounded-xl border border-border-strong bg-surface px-3.5 py-3 text-base text-foreground placeholder:text-text-3 focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";
