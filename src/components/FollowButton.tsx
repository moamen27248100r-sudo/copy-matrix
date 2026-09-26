"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { followTrader, unfollowTrader } from "@/app/discover/actions";

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12l5 5L19 7" />
    </svg>
  );
}

// Follows/unfollows without a full page reload, so it can flip its own
// look immediately and show a one-off toast -- the two things a plain
// <form action={...}> pill can't do without JS driving it.
export function FollowButton({
  providerId,
  providerName,
  initialWatching,
}: {
  providerId: string;
  providerName: string;
  initialWatching: boolean;
}) {
  const t = useTranslations("TraderProfile");
  const [isWatching, setIsWatching] = useState(initialWatching);
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    const wasWatching = isWatching;
    setIsWatching(!wasWatching);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("providerId", providerId);
      try {
        if (wasWatching) {
          await unfollowTrader(fd);
        } else {
          await followTrader(fd);
          setToast({
            title: t("followToastTitle"),
            body: t("followToastBody", { name: providerName }),
          });
          setTimeout(() => setToast(null), 4500);
        }
      } catch {
        // Revert optimistic state if the server action actually failed.
        setIsWatching(wasWatching);
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={
          isWatching
            ? "inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-slate-800 px-3 py-0.5 text-xs text-emerald-400 disabled:opacity-60"
            : "inline-flex items-center gap-1 rounded-full border border-accent px-3 py-0.5 text-xs text-accent disabled:opacity-60"
        }
      >
        {isWatching && <CheckIcon className="h-3 w-3" />}
        {isWatching ? t("followingLabel") : t("follow")}
      </button>

      {toast && (
        // Top corner, not bottom: the trader page has its own fixed
        // bottom copy bar on mobile, which a bottom-anchored toast would
        // collide with.
        <div
          role="status"
          className="fixed top-4 start-4 z-50 flex max-w-xs flex-col gap-0.5 rounded-lg border border-slate-700/70 bg-[#0b1222] p-3 shadow-lg shadow-black/30 sm:top-6 sm:start-6"
        >
          <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-400">
            <CheckIcon className="h-4 w-4 shrink-0" />
            {toast.title}
          </p>
          <p className="text-xs text-muted">{toast.body}</p>
        </div>
      )}
    </>
  );
}
