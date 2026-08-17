"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type ActiveDrawer = "menu" | "notifications" | null;
type Ctx = { active: ActiveDrawer; setActive: (d: ActiveDrawer) => void };

const NavDrawerContext = createContext<Ctx | null>(null);

export function NavDrawerProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ActiveDrawer>(null);
  return <NavDrawerContext.Provider value={{ active, setActive }}>{children}</NavDrawerContext.Provider>;
}

// Only one of the header's drawers (the hamburger menu or the notifications
// bell) can be open at a time — opening one closes the other automatically.
export function useNavDrawer(key: "menu" | "notifications") {
  const ctx = useContext(NavDrawerContext);
  if (!ctx) throw new Error("useNavDrawer must be used within NavDrawerProvider");
  const open = ctx.active === key;
  const toggle = () => ctx.setActive(open ? null : key);
  const close = () => {
    if (ctx.active === key) ctx.setActive(null);
  };
  return { open, toggle, close };
}
