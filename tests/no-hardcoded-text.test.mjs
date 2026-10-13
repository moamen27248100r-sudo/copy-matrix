// Guards the "every visible text comes from the translation files" rule (CLAUDE.md): customer-facing
// components and pages must not contain literal words in JSX text, user-visible attributes, or
// dates/numbers formatted with a fixed language. The admin panel (Arabic-only by design), API routes
// and generated images are out of scope.
//
// (MarginCallForm and ImpersonationBanner are admin tools, Arabic by design.)
// A deliberate exception goes in ALLOWED below with a reason (brand names, instrument codes, ...).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = "src";
const SKIP_DIRS = new Set([join("src", "app", "admin"), join("src", "app", "api"), join("src", "messages"), join("src", "components", "showcase")]);
const SKIP_FILES = [/opengraph-image\.tsx$/, /icon\.tsx$/, /apple-icon\.tsx$/, /AdminSidebar\.tsx$/, /MarginCallForm\.tsx$/, /ImpersonationBanner\.tsx$/, /[\\/]lib[\\/]symbol-icons\.tsx$/];

// literal text that is allowed to stay as it is
const ALLOWED = new Set([
  "Copy Matrix", // the platform name
  "USDT", // asset code
  "Tether", // asset name next to its code
  "BTC", "ETH", "BNB", "SOL", "XRP", "XAU", "EUR", "USD", "GBP", "JPY", "TRC20", "BEP20", "ERC20", // codes
  "OK", "i", "KYC", "CSV", "PDF", "QR", "TxID", "AUM", "ROI", "P&L", "Sharpe", "RTL", "LTR", "PnL",
  "Google", "WhatsApp", "Telegram",
  // the platform's native-language names in the language picker
  "العربية", "English", "Français", "Español", "Português", "中文", "हिन्दी", "اردو", "Bahasa Indonesia", "Tiếng Việt", "ไทย", "বাংলা", "Kiswahili",
]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (SKIP_DIRS.has(p)) continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(name) && !SKIP_FILES.some((re) => re.test(p))) out.push(p);
  }
  return out;
}

const WORD = /[A-Za-zÀ-ɏ؀-ۿऀ-ॿ฀-๿一-鿿]{3,}/;

function stripCommentsAndCode(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ");
}

function findViolations(file) {
  const raw = readFileSync(file, "utf8");
  const src = stripCommentsAndCode(raw);
  const found = [];
  // 1. JSX text between tags: ">  some words  <" with no braces inside
  for (const m of src.matchAll(/(?<![=-])>([^<>{}=;&"()|?:]*)</g)) {
    const text = m[1].replace(/\s+/g, " ").trim();
    if (!text || ALLOWED.has(text) || !WORD.test(text)) continue;
    // generic type arguments / comparisons look like ">...<" too; require a space-separated word or non-Latin letters
    if (/^[A-Za-z0-9_.,\s|&*()[\]-]*$/.test(text) && !/\s/.test(text) && text.length < 12 && /^[A-Z]/.test(text) === false) continue;
    found.push(`JSX text: "${text}"`);
  }
  // 2. visible attributes with a literal string
  for (const m of src.matchAll(/\b(placeholder|aria-label|title|alt)="([^"{}]+)"/g)) {
    const text = m[2].trim();
    if (!text || ALLOWED.has(text) || !WORD.test(text)) continue;
    found.push(`${m[1]}="${text}"`);
  }
  // 3. dates formatted with a fixed language instead of the interface language
  for (const m of src.matchAll(/toLocale(?:Date|Time)?String\(\s*"(en|ar)(?:-[A-Z]{2})?"/g)) {
    if (/toLocaleString\(\s*"en-US"/.test(m[0]) && !/Date|Time/.test(m[0])) continue; // plain number grouping
    found.push(`fixed-language date: ${m[0]}`);
  }
  return found;
}

test("no hard-coded user-facing text in customer components and pages", () => {
  const problems = [];
  for (const file of walk(ROOT)) {
    for (const v of findViolations(file)) problems.push(`${relative(".", file).split(sep).join("/")}: ${v}`);
  }
  assert.deepEqual(problems, [], `Untranslated or fixed-language text found:\n${problems.join("\n")}`);
});
