# Copy Matrix — Dashboard Redesign Tasks

Tracks the two big prompts (nav/dashboard-home redesign + the follow-up
"استمر" prompt covering the rest of the customer area). One line per item,
`[x]` done and shipped to `main`, `[ ]` not done yet. Grouped to match the
original prompts' own section order.

## 1) Navigation

- [x] Bottom nav bar (mobile/tablet, 5 items: home/discover/my-copies/trades/portfolio)
- [x] Fixed sidebar (desktop, same sections)
- [x] Header: logo, account-type pill, notifications bell, avatar (opens profile drawer)
- [x] Profile drawer cleaned up: balance card/deposit/withdraw/account-switcher removed, name+masked email+KYC badge added
- [x] Drawer slides from the side with a dim backdrop, closes on outside click
- [ ] Drawer closes on swipe gesture (not implemented, click-outside only)
- [x] Language switcher moved into the drawer
- [ ] Language switcher inside Settings itself (not added there yet)
- [x] All 13 locales are effectively fully translated already — no filtering needed, reported the completeness % back to the user instead

## 2) Dashboard home (أ–ط)

- [x] أ) Price ticker unchanged
- [x] ب) Time-based greeting (morning/evening), email removed
- [x] ج) Hero card: total value, today's/total profit (amount+%), mini equity chart with period buttons inside the card, cash/reserved row, account-type-specific action buttons
- [x] د) One smart banner at a time (KYC for unverified real accounts, "switch to real" for demo, never both)
- [x] هـ) "Start in 4 steps" onboarding card (progress bar, links to each step)
- [x] هـ) "Suggested traders for you" horizontal-scroll carousel
- [x] و) Active copies as multiple cards (multi-copy support)
- [x] و) Open positions table
- [x] و) Portfolio allocation donut (hand-rolled SVG, no chart library existed)
- [x] و) Recent activity timeline
- [ ] و) Active-copy card's "pause" action (only permanent stop exists, no pause)
- [ ] و) Open-positions table limited to latest 5 + "view all" + source-trader column (currently shows all, no trader column)
- [x] ز) "Most copied this week" (everyone, bottom of page)
- [x] ح) "Quick access" grid removed
- [x] ط) Risk disclaimer line at the bottom

## 3) Rest of the pages

- [x] Discover: sort by total profit
- [x] Discover: card/table view toggle
- [x] Discover: "favorites only" filter
- [x] Discover: fixed a real bug — stale single-copy block was still disabling the copy button after multi-copy shipped
- [ ] Discover: sort/filter by max drawdown (no precomputed column, would need a per-provider signals scan)
- [ ] Discover: period filter (7/30/90/180 days) that changes displayed stats
- [ ] Discover: compare up to 4 traders
- [x] Trader page: tabs (performance / open trades / history / asset allocation)
- [x] Trader page: colored monthly-returns calendar (12-month heatmap)
- [ ] Trader page: AUM, Sharpe ratio, avg. trade duration, profit-share % (no data source for any of these yet)
- [ ] Copy modal: proper dialog with copy mode (fixed-ratio/fixed-amount), copy-open-trades toggle, collapsible advanced settings (max per trade, copy stop-loss, trailing stop, per-trade TP/SL), risk acknowledgment — still a bare inline form (amount only)
- [ ] Dedicated "My Copies" page (bottom nav currently links to the dashboard's active-copies section, not a real page)
- [ ] Dedicated "Trades" page: open tab (edit TP/SL, close all) + history tab (filters, CSV export) — bottom nav links to `/portfolio?tab=positions` which doesn't have these yet
- [ ] Portfolio: short monthly report (balances + transaction history already existed before this work)
- [ ] Notifications: categories (trades/copy/account/security)
- [ ] Notifications: per-type preferences page (in-app/email/Telegram)
- [ ] Settings: security section (2FA, active sessions) — **on hold, pending a decision on real TOTP vs. UI-only vs. skip**
- [ ] Settings: language + timezone section
- [ ] Settings: risk questionnaire that feeds "suggested traders"

## 4) Design system

- [x] Green profit / red loss with arrow convention — already existed, preserved throughout
- [ ] Unified 4/8px spacing scale
- [ ] Unified type scale (page title / section title / body / secondary)
- [ ] `tabular-nums` on numeric displays
- [ ] Shared Skeleton loading component
- [ ] Shared Empty-state component
- [ ] Shared Error-state-with-retry component
- [ ] Thin amber "you're in demo mode" strip at the top of the page
- [ ] Light animations (number count-up, flash on change)

## Data & backend (added scope, not in the original prompts)

- [x] Multiple simultaneous copies supported (removed the single-active-subscription rule)
- [x] Mirrored position size capped at each copy's own `allocated_amount`, never the customer's whole balance
- [x] Per-subscription exposure cap: a new trade only mirrors up to remaining headroom, skipped once a copy's allocation is fully used
- [x] Migrations 0192–0194 applied live and verified against a disposable test account
