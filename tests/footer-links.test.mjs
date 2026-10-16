// Every link in the visitor footer reaches a page that exists, every label is translated in all 13
// languages, and the accordion announces its state.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { FOOTER_SECTIONS } from "../src/lib/footer-links.ts";
import { LEARN_ARTICLES } from "../src/lib/learn.ts";

const LOCALES = ["ar", "en", "fr", "es", "pt", "zh", "hi", "ur", "id", "vi", "th", "bn", "sw"];
const messages = Object.fromEntries(LOCALES.map((l) => [l, JSON.parse(fs.readFileSync(`src/messages/${l}.json`, "utf8"))]));
const markets = fs.readFileSync("src/lib/markets.ts", "utf8");

function reaches(href) {
  const [path] = href.split("#");
  if (path === "/" || path === "") return fs.existsSync("src/app/page.tsx");
  const m = path.match(/^\/learn\/(.+)$/);
  if (m) return LEARN_ARTICLES.includes(m[1]);
  const mk = path.match(/^\/markets\/(.+)$/);
  if (mk) return fs.existsSync("src/app/markets/[symbol]/page.tsx") && markets.includes(`"${mk[1]}"`) || markets.includes(mk[1].replace("USDT", ""));
  return fs.existsSync(`src/app${path}/page.tsx`);
}

test("every footer link reaches an existing page", () => {
  const bad = [];
  for (const s of FOOTER_SECTIONS) for (const l of s.links) if (!reaches(l.href)) bad.push(l.href);
  assert.deepEqual(bad, []);
});

test("the footer has the sections and links that were asked for", () => {
  assert.deepEqual(FOOTER_SECTIONS.map((s) => s.key), ["product", "platform", "support", "company", "legal"]);
  const labels = (k) => FOOTER_SECTIONS.find((s) => s.key === k).links.map((l) => l.key);
  assert.deepEqual(labels("product"), ["copyTrading", "discoverTraders", "markets", "crypto", "gold", "forex"]);
  assert.deepEqual(labels("platform"), ["howItWorks", "riskManagement", "fees", "becomeLeader"]);
  assert.deepEqual(labels("support"), ["helpCenter", "contact", "riskDisclosure"]);
  assert.deepEqual(labels("company"), ["about"]);
  assert.deepEqual(labels("legal"), ["terms", "privacy", "riskDisclosure", "cookies"]);
});

test("every footer label and the new pages are translated in all languages", () => {
  const keys = new Set(FOOTER_SECTIONS.flatMap((s) => [s.key, ...s.links.map((l) => l.key)]));
  for (const l of LOCALES) {
    for (const k of [...keys, "intro", "riskWarning", "notBroker"]) assert.ok(messages[l].VisitorFooter?.[k], `${l} VisitorFooter.${k}`);
    for (const k of ["feesTitle", "feesIntro", "feesSections", "contactTitle", "contactIntro", "cookiesTitle", "cookiesSections"]) assert.ok(messages[l].FooterPages?.[k], `${l} FooterPages.${k}`);
    assert.equal(messages[l].FooterPages.feesSections.length, 5, `${l} fees sections`);
    assert.equal(messages[l].FooterPages.cookiesSections.length, 4, `${l} cookies sections`);
  }
});

test("the fees page states the real range and the high-water mark", () => {
  const en = messages.en.FooterPages.feesSections.map((s) => s.body).join(" ");
  assert.match(en, /5% and 30%/);
  assert.match(en, /high-water mark/);
});

test("the accordion announces its state and the footer is on visitor pages only", () => {
  const f = fs.readFileSync("src/components/VisitorFooter.tsx", "utf8");
  assert.match(f, /aria-expanded=\{isOpen\}/);
  assert.match(f, /aria-controls/);
  const layout = fs.readFileSync("src/app/layout.tsx", "utf8");
  assert.match(layout, /showFooter = !hasSession/);
});
