"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { withoutFlashParams } from "@/lib/flash-params";

// Removes ?error= / ?success= from the address bar after the page has rendered them (history.replaceState keeps
// the router in sync, nothing is refetched), so a reload or a shared link does not repeat the message.
export function StripFlashParams() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    const clean = withoutFlashParams(pathname, search, window.location.hash);
    if (clean) window.history.replaceState(window.history.state, "", clean);
  }, [pathname, search]);
  return null;
}
