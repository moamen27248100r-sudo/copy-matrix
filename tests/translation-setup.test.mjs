// The platform opens in English for everyone, never guesses a language from the device, and keeps
// names, brand, symbols and figures out of browser translation.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { DEFAULT_LOCALE, LOCALE_COOKIE } from "../src/i18n/locales.ts";

const read = (p) => fs.readFileSync(p, "utf8");

test("English is the default and nothing reads the device language", () => {
  assert.equal(DEFAULT_LOCALE, "en");
  assert.notEqual(LOCALE_COOKIE, "locale", "the old auto-detected cookie is not trusted any more");
  assert.ok(!/accept-language/i.test(read("src/proxy.ts")));
  assert.ok(!/accept-language/i.test(read("src/i18n/request.ts")));
});

test("the html element follows the selected language", () => {
  const layout = read("src/app/layout.tsx");
  assert.match(layout, /lang=\{locale\}/);
  assert.match(layout, /dir=\{dir\}/);
});

test("brand, leader names and figures are marked translate=no", () => {
  assert.match(read("src/components/Logo.tsx"), /translate="no"/);
  assert.match(read("src/components/LeaderCard.tsx"), /translate="no"[^>]*>\{p\.display_name\}/);
  assert.match(read("src/components/NoTranslateMarker.tsx"), /tabular-nums/);
});

test("the hero headline is one translation unit (no inner element splitting the sentence)", () => {
  assert.match(read("src/app/page.tsx"), /t\.rich\("hero\.title", \{ accent: \(chunks\) => chunks \}\)/);
});
