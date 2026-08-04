import Link from "next/link";

export function LegalNav() {
  return (
    <nav className="flex items-center justify-between border-b border-border px-6 py-4">
      <Link href="/" className="flex items-center gap-1.5 text-lg font-semibold" dir="ltr">
        Copy Matrix
        <span className="flex items-center">
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 text-brand"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 19l3-5 3 3 5-9" />
            <path d="M12 8h4v4" />
          </svg>
          <svg
            viewBox="0 0 24 24"
            className="-ml-1.5 h-4 w-4 text-brand"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 19l3-5 3 3 5-9" />
            <path d="M12 8h4v4" />
          </svg>
        </span>
      </Link>
      <div className="flex items-center gap-3">
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          العودة إلى الرئيسية
        </Link>
      </div>
    </nav>
  );
}
