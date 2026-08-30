import Link from "next/link";
import { Logo } from "@/components/Logo";

export function LegalNav() {
  return (
    <nav className="sticky top-0 z-[9999] flex items-center justify-between border-b border-border bg-background px-6 py-4">
      <Link href="/" className="flex items-center">
        <Logo iconClassName="h-8 w-8" textClassName="text-lg" />
      </Link>
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="rounded border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:border-accent hover:text-accent"
        >
          العودة إلى الرئيسية
        </Link>
      </div>
    </nav>
  );
}
