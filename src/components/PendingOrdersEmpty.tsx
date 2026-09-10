export function PendingOrdersEmpty() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-6 text-center">
      <svg viewBox="0 0 24 24" className="h-6 w-6 text-muted" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" />
      </svg>
      <p className="text-sm text-muted">لا توجد أوامر معلقة حاليًا</p>
      <p className="text-xs text-muted">
        Copy Matrix ينفّذ نسخ الصفقات فور تنفيذها عند المتداول مباشرة، وليس عبر أوامر معلّقة يدوية.
      </p>
    </div>
  );
}
