import { Home, Users, Activity, Wallet } from "lucide-react";

// Shared chrome every screen renders identically: the iOS-style status
// bar and the bottom tab bar (active tab swaps per screen). Kept here,
// not duplicated three times, since it's pixel-identical across screens.

export function StatusBar() {
  return (
    <div className="flex items-center justify-between px-4 pt-2 text-[11px] font-medium text-white" aria-hidden="true">
      <span dir="ltr">9:41</span>
      <div className="flex items-center gap-1">
        <svg viewBox="0 0 18 12" className="h-2.5 w-4" fill="currentColor" aria-hidden="true">
          <rect x="0" y="7" width="3" height="5" rx="0.5" />
          <rect x="5" y="4" width="3" height="8" rx="0.5" />
          <rect x="10" y="1" width="3" height="11" rx="0.5" />
        </svg>
        <svg viewBox="0 0 16 12" className="h-2.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
          <path d="M1 5a10 10 0 0 1 14 0M3.5 7.5a6 6 0 0 1 9 0M6 10a2.3 2.3 0 0 1 4 0" strokeLinecap="round" />
        </svg>
        <span className="h-2.5 w-5 rounded-sm border border-current" />
      </div>
    </div>
  );
}

export type BottomTab = "home" | "traders" | "trades" | "wallet";

const TABS: { key: BottomTab; Icon: typeof Home }[] = [
  { key: "home", Icon: Home },
  { key: "traders", Icon: Users },
  { key: "trades", Icon: Activity },
  { key: "wallet", Icon: Wallet },
];

export function BottomNav({ active }: { active: BottomTab }) {
  return (
    <div className="flex items-center justify-between border-t border-white/[0.06] px-6 pb-3 pt-2.5" aria-hidden="true">
      {TABS.map(({ key, Icon }) => (
        <Icon key={key} className={"h-4 w-4 " + (key === active ? "text-accent" : "text-muted")} strokeWidth={2} />
      ))}
    </div>
  );
}
