@AGENTS.md

## Translations

Any new or changed user-facing text must be added as a translation key in all 13 locale files (`src/messages/*.json`: ar, en, fr, es, pt, zh, hi, ur, id, vi, th, bn, sw) in the same change. Never hard-code user-facing text in components.

After any change to user-facing text or `src/messages/*.json`, run `npm run i18n:check`. It fails if any locale is missing a key, has an extra key, or still holds the English text (brand names and tickers such as BTC/USDT are exempt). Genuinely identical words (e.g. a loanword spelled the same in that language) go in `scripts/i18n-allow.json`, not in a translation hack.

## Temporary files

Create any temporary or scratch file (debug scripts, one-off SQL/JSON, translation specs) outside the project folder, in the session scratchpad. If one must live in the project, delete it before committing. Never commit scratch files; check `git status` before every commit.
