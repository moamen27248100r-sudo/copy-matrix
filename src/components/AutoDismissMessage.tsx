"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Deposit/withdrawal success (and error) banners are driven by a query
// param (?success=1), so they'd otherwise sit there indefinitely until the
// customer navigates elsewhere or refreshes — this hides itself after a
// few seconds and strips the param so a refresh doesn't bring it back.
export function AutoDismissMessage({
  children,
  className,
  clearParams,
  delayMs = 5000,
}: {
  children: React.ReactNode;
  className: string;
  clearParams: string[];
  delayMs?: number;
}) {
  const [visible, setVisible] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      const url = new URL(window.location.href);
      for (const param of clearParams) url.searchParams.delete(param);
      router.replace(url.pathname + url.search, { scroll: false });
    }, delayMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;
  return <p className={className}>{children}</p>;
}
