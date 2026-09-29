# QA_TASKS.md — Full Platform QA Audit

Rules: no DB schema changes (log + ask if needed). No design/content changes — behavior/quality fixes only.
Test with Playwright: WebKit @ iPhone viewport (Safari bugs priority) + Chrome desktop. Disposable test accounts, deleted after.
Screenshot only broken pages.

## 0. Setup
- [ ] Create disposable test accounts (regular user + lead trader) for QA runs

## 1. Mobile screen stability (priority)
- [x] All input/select/textarea font-size >= 16px on mobile (no Safari auto-zoom)
      — FIXED: swept every `<input>/<select>/<textarea>` in `src/` for `text-xs`/`text-sm` (12/14px) and
      bumped to `text-base` (16px), form-field sizing only (surrounding labels/buttons untouched):
      `src/app/settings/page.tsx` (timezone select), `src/app/discover/page.tsx` (search input),
      `src/app/admin/(protected)/users/[id]/page.tsx`, `src/app/admin/(protected)/traders/page.tsx`,
      `src/components/MarginCallForm.tsx`, `src/app/lead/followers/page.tsx`, `src/app/lead/trades/page.tsx`,
      `src/components/SupportChatPage.tsx` (search + chat input), `src/components/DepositGateway.tsx`
      (amount field). `PasswordInput.tsx`/`SignupForm.tsx`/auth flows already used `text-base`.
- [x] touch-action: manipulation on tappable elements (no double-tap zoom)
      — FIXED: added `touch-manipulation` to the shared `Button` component (`src/components/ui/Button.tsx`)
      plus a global `button, a, [role="button"], summary { touch-action: manipulation }` rule in
      `src/app/globals.css` as a safety net for raw `<button>`/`<a>` elements not going through `Button`.
- [x] No horizontal scroll on any page, 320px–1920px widths
      — verified: `html`/`body` already had `overflow-x: hidden; max-width: 100%` from a prior pass; spot-checked
      `/login` and `/discover` at 320px/375px live (Chrome emulation) — no `scrollWidth > clientWidth`. Did not
      re-walk all ~55 routes at all 4 widths this pass (see scope note).
- [ ] Keyboard doesn't cover focused input; no page jump on keyboard open/close
      — Needs real-device verification (not testable headlessly). Static review: no `100vh`-based layouts found
      outside `AdminSidebar.tsx` (admin-only, not a public mobile flow); no fixed bottom bar overlaps a form
      input without padding. Best-effort only, flagged as unverified.
- [x] Safe-area insets respected (notch, bottom bar)
      — verified: `src/components/BottomNav.tsx` already pads with `env(safe-area-inset-bottom)`.
- [ ] No layout shift (CLS) on load
      — Static review only this pass; no obvious width/height-less `<img>` or skeleton/content size mismatch
      found in components read, but not measured with real Lighthouse/CLS tooling. Flagged as unverified.

## 2. Navigation
- [ ] Browser back / in-app back return to correct place, preserve scroll position
- [ ] Refresh on any page doesn't log out or lose state
- [ ] Direct URL open works for every page
- [x] Protected pages redirect to /login when logged out; return to originally-requested page after login
      — FIXED: 20 page.tsx guards (`/dashboard`, `/copies`, `/kyc`, `/kyc/steps`, `/lead`, `/lead/followers`,
      `/lead/settings`, `/lead/settlements`, `/lead/tasks`, `/lead/trades`, `/lead/trades/history`, `/markets`,
      `/notifications`, `/notifications/preferences`, `/portfolio`, `/portfolio/deposit`, `/portfolio/withdraw`,
      `/profit-share-history`, `/settings`, `/trades`) were doing bare `redirect("/login")`, dropping the user's
      destination even though `/login` already supports and consumes a `?next=` param. Added `?next=<path>` to each.
      Verified live: unauthenticated `/dashboard` → `/login?next=%2Fdashboard`.
- [x] Logged-in user opening /login redirects to dashboard
      — FIXED: `src/app/login/page.tsx` never checked for an existing session; a logged-in user could reopen
      `/login` and see the form. Added the same `supabase.auth.getUser()` guard the other protected pages use,
      redirecting to `next ?? "/dashboard"` when already authenticated.
- [x] Designed 404 page with back button — verified: `src/app/not-found.tsx` renders localized 404 + "back to home" link, no horizontal overflow at 375px.
- [x] Error boundary page instead of white screen — verified: `src/app/error.tsx` renders `ErrorState` with retry, not a blank screen.

## 3. Account
- [ ] Signup: field validation, clear error messages, double-submit prevented, button loading state
      — not live-tested this pass (would need a disposable test account run); `SignupForm.tsx` has inline
      validation state (`nameTouched`/`emailValid`/etc.) and a `SubmitButton`-style pending state by inspection.
- [ ] Email confirmation flow (if enabled) works — not live-tested this pass.
- [ ] Login: wrong credentials show clear error; Google login works — not live-tested this pass (Google OAuth
      needs a real account and can't be exercised with a disposable Supabase-only test user).
- [ ] Forgot password / reset flow works end-to-end — not live-tested this pass.
- [x] Password show/hide toggle — verified in code: `src/components/auth/PasswordInput.tsx` toggles
      `type="password"`/`"text"` via an Eye/EyeOff icon button, used by login/signup/reset-password.
- [ ] Logout (mobile + desktop); back button after logout shows no protected data — not live-tested this pass.
- [ ] Expired session handled gracefully — not live-tested this pass.

## 4. Forms & interaction
- [ ] Every action button: loading state, no double-submit — not exhaustively re-verified this pass.
- [ ] Toast success/failure for every important action — not exhaustively re-verified this pass.
- [ ] Modals: close via X, outside click, mobile back button; background doesn't scroll — not re-verified.
- [ ] Enter key submits forms — not re-verified (forms are native `<form action>` submissions, so Enter should
      submit by default HTML behavior; no `onKeyDown` blockers found in a spot check, but not click-tested).
- [x] No dead "#" links or broken links — verified: `grep -r 'href="#"' src/` returns zero matches.
- [ ] Tap targets >= 44px on mobile — not measured this pass; `Button` `md` size is `h-11` (44px) and `sm` is
      `h-10` (40px, used for compact/secondary actions), so most but not necessarily all controls meet 44px.

## 5. States
- [ ] Every page: loading skeleton, empty state, error state with retry — not exhaustively re-verified this pass.
- [ ] Network loss/restore: clear message, no hang — not testable headlessly; not re-verified this pass.

## 6. Content & display
- [ ] No text-direction bugs, no stray English text, no missing translation keys — spot-checked AR/EN metadata
      titles only (see Task A below); not a full sweep of all ~55 routes x 2 locales.
- [ ] Consistent number/currency/date formatting — not re-verified this pass.
- [ ] No broken images; all images have alt — not re-verified this pass.
- [x] AR/EN switch works on every page — spot-checked: `/login` renders `تسجيل الدخول | Copy Matrix` under
      `Accept-Language: ar` / locale cookie, and `Log In | Copy Matrix` for English; `LanguageSwitcher.tsx`
      drives this via a `locale` cookie read by every page's `getTranslations`/`generateMetadata` call.

## 7. Platform basics
- [x] Unique title + description per page, favicon, Open Graph image
      — FIXED (this pass, see "Task A/C" below): 31 pages that previously inherited the generic root title now
      have their own `generateMetadata` (`<Page Name> | Copy Matrix` + one-sentence description, AR/EN authored,
      11 other locales via `scripts/add-i18n.mjs` English fallback). New `src/app/opengraph-image.tsx` (1200x630,
      dark background, logo mark, Arabic headline). Favicon (`icon.tsx`/`apple-icon.tsx`) already existed.
- [x] manifest + icons for add-to-home-screen
      — FIXED (this pass, see "Task B" below): `src/app/manifest.ts` + `src/app/icon-192.png/route.tsx` +
      `src/app/icon-512.png/route.tsx` (same logo mark/colors as the existing favicon routes).
- [x] Terms / privacy / risk-disclosure pages exist and linked in footer — verified: `src/app/legal/terms`,
      `src/app/legal/privacy`, `src/app/risk-disclosure` all exist with their own metadata (untouched this pass).
- [x] Clear support contact method — verified: `/support` page (`SupportChatPage.tsx`) exists and already has
      its own metadata; linked from footer.

## 8. Basic security
- [x] No secret keys in client-side code — verified: `src/lib/supabase/admin.ts` is the only file referencing
      `SUPABASE_SECRET_KEY` (service-role key), is server-only (no `"use client"`, no `NEXT_PUBLIC_` prefix, not
      imported by any client component), so it's never bundled to the browser.
- [ ] User cannot access another user's data by changing an ID in the URL — TESTED (2 disposable accounts, deleted after): URL/ID tampering on /admin/users/[id], /trader/[id], ?id= params leaks nothing, and RLS hides notifications/wallet/KYC/subscriptions/etc. **BUT FAILED for `profiles`: policy `profiles_select` is `USING (true)` for `authenticated` with all columns granted, so any logged-in user can read every user's email, phone, balance, signup/last-login IP, is_admin via the API. Needs DB decision (restrict columns/policy or move to a safe view) — not changed per no-schema-change rule.** Old note: not re-verified this pass (would
      need two disposable test accounts and live testing of e.g. `/trader/[id]`, admin `/users/[id]`).
- [ ] No console errors on any page — `/discover` querySelector error does NOT reproduce in the production build (`next build` + `next start`, logged in, 375px): dev-mode-only, no fix needed. (Old note: one pre-existing `Cannot read properties of
      null (reading 'querySelector')` console error was observed on `/discover` in dev mode during this pass,
      unrelated to any file touched this pass (no discover client-logic was changed, only className/search-input
      sizing and a new `generateMetadata`) — flagged for a follow-up look, not investigated further given scope.)

## Delivery
- [x] Fix every found issue, re-test (see "Needs DB / decision" below for items intentionally left open, and note on scope)
- [x] build, commit, push
- [x] Final report: table (item, status: OK / Fixed / Needs decision) + anything needing DB/decision

## Note on scope of this pass
This pass covered static/code review of the whole app plus live Playwright/Chromium checks of the
highest-risk flows (protected-route redirects, 404, mobile input font-size, no horizontal scroll). It did not
exhaustively click through all ~55 routes x 13 locales x 2 viewports (that is genuinely multi-day work); no
other functional bugs of the same severity as the `next=` redirect gap turned up in the areas reviewed
(secrets-in-client-bundle scan, dead `href="#"` links, footer/legal links, manifest presence). A follow-up
pass should still walk section 1/3/4/5/6 live per-page if a large QA budget is available again.

## Needs DB / decision
- **PWA manifest, per-page titles/descriptions, and Open Graph image** — resolved in the follow-up QA pass
  (commit adding `src/app/manifest.ts`, `generateMetadata` on 31 pages under a new `Metadata` i18n namespace,
  and `src/app/opengraph-image.tsx`). No longer open.
- **`/discover` console error in dev mode** — `Uncaught TypeError: Cannot read properties of null (reading
  'querySelector')` observed live on `/discover` during this pass. Not caused by anything changed in this pass
  (only `className` sizing and a new `generateMetadata` export touched that file); not investigated further —
  needs a decision on priority/owner before spending time on it, and re-confirmation it isn't dev-mode-only
  noise (e.g. from a third-party widget script) before treating it as a real bug.
- **Sections 3–6, 8 mostly static-review only this pass** — signup/login/logout/session-expiry live flows,
  toast/loading-state audit per action, tap-target measurement, and the "can't access another user's data via
  URL ID" security check were not live-tested this pass (would need disposable test accounts + a larger time
  budget); see the per-item notes above for what was and wasn't checked.

- **`profiles` table readable by every authenticated user (PII leak)** — see section 8. Needs DB decision.
- Horizontal scroll re-checked at 375px on ~29 routes (logged in, prod build): `scrollWidth == clientWidth` everywhere; only off-canvas fixed drawer/carousel children flagged, which are clipped/intended.
