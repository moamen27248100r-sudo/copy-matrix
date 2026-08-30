export function Logo({
  iconClassName = "h-8 w-8",
  textClassName = "text-lg",
  className = "",
}: {
  iconClassName?: string;
  textClassName?: string;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 whitespace-nowrap ${className}`} dir="ltr">
      <span
        className={`flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-brand ${iconClassName}`}
      >
        <svg viewBox="0 0 24 24" className="h-[58%] w-[58%] text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 17l6-6 4 4 8-8" />
          <path d="M15 6h6v6" />
        </svg>
      </span>
      <span className={`font-semibold ${textClassName}`}>Copy Matrix</span>
    </span>
  );
}
