"use client";

import { ErrorState } from "@/components/ui/ErrorState";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-6 pt-24">
      <ErrorState onRetry={reset} />
    </main>
  );
}
