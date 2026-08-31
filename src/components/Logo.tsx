export function Logo({
  iconClassName = "h-5 w-5",
  textClassName = "text-xl",
  className = "",
}: {
  iconClassName?: string;
  textClassName?: string;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-0.5 whitespace-nowrap ${className}`} dir="ltr">
      <span className={`font-bold ${textClassName}`}>Copy Matrix</span>
      <span className="flex items-center">
        <svg viewBox="0 0 24 24" className={`text-brand ${iconClassName}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 19l3-5 3 3 5-9" />
          <path d="M12 8h4v4" />
        </svg>
        <svg viewBox="0 0 24 24" className={`-ml-2 text-brand ${iconClassName}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 19l3-5 3 3 5-9" />
          <path d="M12 8h4v4" />
        </svg>
      </span>
    </span>
  );
}
