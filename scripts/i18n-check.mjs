// npm run i18n:check
// Fails when any locale in src/messages has a key that en.json lacks (extra),
// lacks a key that en.json has (missing), or still holds the English text
// (untranslated). Brand names, tickers and symbols such as BTC / USDT are
// exempt, as are the per-locale exceptions in scripts/i18n-allow.json
// (e.g. a loanword that is genuinely spelled the same in that language).
import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "src/messages");
const allowFile = path.join(process.cwd(), "scripts/i18n-allow.json");
const allow = fs.existsSync(allowFile) ? JSON.parse(fs.readFileSync(allowFile, "utf8")) : {};

const EXEMPT_WORDS = new Set(
  [
    "BTC", "ETH", "USDT", "USDC", "USD", "XAU", "XAG", "EUR", "GBP", "JPY", "TRC20", "ERC20", "BEP20", "TRX",
    "Copy", "Matrix", "Bitcoin", "Ethereum", "Google", "TOTP", "KYC", "ID", "PDF", "CSV", "QR", "TxID", "Telegram",
    "UID", "PnL", "P/L", "S/L", "T/P", "OK", "Demo", "VIP", "Forex", "Swap", "API", "SMS", "Email", "App", "Online",
  ].map((w) => w.toLowerCase()),
);

function flatten(value, prefix = "", out = {}) {
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  } else {
    out[prefix] = value;
  }
  return out;
}

function isExemptText(text) {
  if (typeof text !== "string") return true;
  if (/^[a-z0-9]+(?:[-_.][a-z0-9]+)*$/.test(text)) return true; // identifiers / slugs
  const stripped = text
    .replace(/\{[^}]*\}/g, " ") // ICU placeholders
    .replace(/<\/?[\w-]+>/g, " ") // rich-text tags
    .replace(/https?:\/\/\S+|\S+@\S+/g, " ") // urls / emails
    .replace(/[^\p{L}\s/]/gu, " ");
  const words = stripped.split(/\s+/).filter((w) => /\p{L}{2,}/u.test(w));
  return words.every((w) => EXEMPT_WORDS.has(w.toLowerCase()));
}

// Support-chat search keywords are free-form synonym lists: each language may
// have a different number of them, so only their presence is required.
const isSearchKeyword = (key) => /\.keywords\.\d+$/.test(key);

const en = flatten(JSON.parse(fs.readFileSync(path.join(dir, "en.json"), "utf8")));
const problems = [];

for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "en.json")) {
  const locale = file.replace(".json", "");
  const data = flatten(JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")));
  const exempt = new Set(allow[locale] ?? []);

  for (const key of Object.keys(en)) {
    if (!(key in data)) { if (!isSearchKeyword(key)) problems.push(`${locale}: missing ${key}`); }
    else if (data[key] === en[key] && !exempt.has(key) && !isExemptText(en[key])) {
      problems.push(`${locale}: untranslated ${key} = ${JSON.stringify(String(en[key]).slice(0, 70))}`);
    }
  }
  for (const key of Object.keys(data)) if (!(key in en) && !isSearchKeyword(key)) problems.push(`${locale}: extra key ${key}`);
}

if (process.argv.includes("--keys")) {
  const keys = [...new Set(problems.filter((p) => p.includes("untranslated") || p.includes("missing")).map((p) => p.split(" ")[2]))];
  console.log(keys.join("\n"));
  process.exit(0);
}

if (problems.length > 0) {
  console.error(problems.slice(0, Number(process.env.I18N_MAX ?? 60)).join("\n"));
  if (problems.length > Number(process.env.I18N_MAX ?? 60)) console.error(`... and ${problems.length - Number(process.env.I18N_MAX ?? 60)} more`);
  console.error(`\ni18n:check failed with ${problems.length} problem(s).`);
  process.exit(1);
}
console.log(`i18n:check OK — ${Object.keys(en).length} keys in ${fs.readdirSync(dir).length} locales.`);
