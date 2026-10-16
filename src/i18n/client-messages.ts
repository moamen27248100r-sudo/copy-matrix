// Which translation namespaces the browser receives.
//
// The root layout used to hand the whole catalog (every namespace, ~95 KB of JSON per language) to
// the client provider, on every page. Only client components read it, so the provider now gets just
// the namespaces client components use. The few that belong to a single route are added by that
// route (components/ExtraMessages.tsx). tests/client-messages.test.mjs scans the client components
// and fails when one reads a namespace that is neither here nor routed.

/** Read by client components on many pages: shipped with every page. */
export const GLOBAL_CLIENT_NAMESPACES = [
  "AccountMenu",
  "AccountSecurity",
  "Auth",
  "Common",
  "CopyCalculator",
  "CopyDialog",
  "Countries",
  "Dashboard",
  "Discover",
  "Featured",
  "HomeFeatures",
  "HomeHowItWorks",
  "HomeShowcase",
  "LangSwitcher",
  "LeadTrader.nav",
  "LivePrices",
  "MarketOverview",
  "Markets",
  "Nav",
  "Notifications",
  "OpenOrders",
  "Portfolio",
  "Pwa",
  "SiteFooter",
  "Support",
  "Symbols",
  "TradeHistory",
  "TraderBadges",
  "TraderEquityChart",
  "TraderHistory",
  "TraderProfile",
  "Trades",
  "Wallet",
] as const;

/** Read by client components of one route only; that route wraps itself in <ExtraMessages>. */
export const ROUTE_CLIENT_NAMESPACES = {
  Faq: "src/app/support/page.tsx",
  TwoFactor: ["src/app/account/security/page.tsx", "src/app/login/mfa/page.tsx"],
  AdminIntegrity: "src/app/admin/(protected)/layout.tsx",
} as const;

type Json = Record<string, unknown>;

/** The subset of `all` holding the given namespaces ("A" or the nested "A.b"). */
export function pickMessages(all: Json, namespaces: readonly string[]): Json {
  const out: Json = {};
  for (const ns of namespaces) {
    const path = ns.split(".");
    let src: unknown = all;
    for (const key of path) src = src && typeof src === "object" ? (src as Json)[key] : undefined;
    if (src === undefined) continue;
    let dst = out;
    path.forEach((key, i) => {
      if (i === path.length - 1) dst[key] = src;
      else dst = (dst[key] ??= {}) as Json;
    });
  }
  return out;
}
