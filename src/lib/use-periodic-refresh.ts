"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Silently re-fetches the server component's data on an interval, so a
// position the backend just closed drops off (or moves into history)
// without the viewer needing to reload the page.
export function usePeriodicRefresh(intervalMs = 30000) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs]);
}
