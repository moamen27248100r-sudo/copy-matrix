// The visitor footer's sections and where each link goes. Every target is a real page (or a section
// of the landing page); tests/footer-links.test.mjs checks that each one exists.
export type FooterSection = { key: "product" | "platform" | "support" | "company" | "legal"; links: { key: string; href: string }[] };

export const FOOTER_SECTIONS: FooterSection[] = [
  {
    key: "product",
    links: [
      { key: "copyTrading", href: "/" },
      { key: "discoverTraders", href: "/discover" },
      { key: "markets", href: "/#markets" },
      { key: "crypto", href: "/markets/BTCUSDT" },
      { key: "gold", href: "/markets/XAUUSD" },
      { key: "forex", href: "/markets/EURUSD" },
    ],
  },
  {
    key: "platform",
    links: [
      { key: "howItWorks", href: "/learn/how_copy_works" },
      { key: "riskManagement", href: "/learn/risk_management" },
      { key: "fees", href: "/fees" },
      { key: "becomeLeader", href: "/become-lead-trader" },
    ],
  },
  {
    key: "support",
    links: [
      { key: "helpCenter", href: "/support" },
      { key: "contact", href: "/contact" },
      { key: "riskDisclosure", href: "/risk-disclosure" },
    ],
  },
  { key: "company", links: [{ key: "about", href: "/about" }] },
  {
    key: "legal",
    links: [
      { key: "terms", href: "/legal/terms" },
      { key: "privacy", href: "/legal/privacy" },
      { key: "riskDisclosure", href: "/risk-disclosure" },
      { key: "cookies", href: "/legal/cookies" },
    ],
  },
];
