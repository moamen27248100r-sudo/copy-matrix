import type { ReactNode } from "react";

// The content column of every signed-in page: one maximum width, the same side padding, room for
// the phone's bottom bar and the desktop sidebar. Pages put their sections inside it.
export function AppMain({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <main
      className={`mx-auto flex w-full max-w-5xl flex-col gap-6 p-6 pb-[calc(var(--bottom-nav-h)+1.5rem)] lg:ms-[var(--sidebar-w)] lg:me-0 lg:pb-6 ${className}`}
    >
      {children}
    </main>
  );
}
