// Shared loading placeholder: a pulsing block. Size/shape come from className.
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-lg bg-white/[0.06] ${className}`} />;
}

// Standard page-level skeleton (title + a few cards) used by loading.tsx files.
export function PageSkeleton() {
  return (
    <main
      className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6 pb-[calc(var(--bottom-nav-h)+1.5rem)] lg:ms-64 lg:me-0 lg:pb-6"
      aria-busy="true"
    >
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </main>
  );
}
