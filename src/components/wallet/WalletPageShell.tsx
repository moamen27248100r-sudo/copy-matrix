import Link from "next/link";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";

// Shared frame of the deposit / withdraw / history pages: close button back to the portfolio,
// title, then the page content.
export async function WalletPageShell({
  title,
  children,
  narrow = false,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  narrow?: boolean;
  wide?: boolean;
}) {
  const t = await getTranslations("Portfolio");
  return (
    <main className={`mx-auto flex min-h-screen w-full flex-col gap-6 p-4 sm:p-6 ${narrow ? "max-w-sm" : wide ? "max-w-4xl" : "max-w-lg"}`}>
      <div className="flex items-center justify-between">
        <Link href="/portfolio" aria-label={t("close")} className="text-muted transition hover:text-foreground">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </Link>
      </div>
      <h1 className="text-2xl font-semibold">{title}</h1>
      {children}
    </main>
  );
}

const NOTICE_TONE = {
  danger: "border-danger/30 bg-danger/10 text-danger",
  warning: "border-warning/30 bg-warning/10 text-warning",
  success: "border-success/30 bg-success/10 text-success",
  info: "border-accent/30 bg-accent/10 text-accent",
};

export function WalletNotice({
  tone,
  title,
  children,
  action,
}: {
  tone: keyof typeof NOTICE_TONE;
  title?: string;
  children: ReactNode;
  action?: { href: string; label: string };
}) {
  return (
    <div className={`flex flex-col gap-2 rounded-2xl border px-4 py-3.5 text-sm ${NOTICE_TONE[tone]}`} role={tone === "danger" ? "alert" : "status"}>
      {title && <p className="font-semibold">{title}</p>}
      <div className={title ? "text-foreground/80" : undefined}>{children}</div>
      {action && (
        <Link
          href={action.href}
          className="mt-1 self-start rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:bg-accent-hover"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
