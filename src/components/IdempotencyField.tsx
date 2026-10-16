"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// The hidden key of a form (see lib/idempotency). A new key is made when the page changes (a failed
// attempt that comes back to the form with an error gets a fresh one), or when `refreshOn` changes
// (forms that show their result without leaving the page).
export function IdempotencyField({ refreshOn }: { refreshOn?: unknown }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [key, setKey] = useState("");
  useEffect(() => {
    // a new key per page view or after a failed attempt; random values can only be made in the browser
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setKey(crypto.randomUUID());
  }, [pathname, search, refreshOn]);
  return <input type="hidden" name="idempotencyKey" value={key} />;
}
