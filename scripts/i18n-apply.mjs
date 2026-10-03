// Usage: node scripts/i18n-apply.mjs <spec.json>
// Spec: { "Namespace.sub.key": { "fr": "...", "es": "..." } }  (dotted full paths, array
// indexes allowed). Only the listed locales are written; others are untouched.
import fs from "node:fs";
import path from "node:path";
const spec = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const dir = path.join(process.cwd(), "src/messages");
const touched = {};
for (const [fullKey, byLocale] of Object.entries(spec)) {
  for (const [loc, value] of Object.entries(byLocale)) {
    const p = path.join(dir, `${loc}.json`);
    touched[loc] ??= JSON.parse(fs.readFileSync(p, "utf8"));
    const parts = fullKey.split(".");
    let node = touched[loc];
    for (const part of parts.slice(0, -1)) node = node[part] ??= {};
    node[parts.at(-1)] = value;
  }
}
for (const [loc, data] of Object.entries(touched)) {
  fs.writeFileSync(path.join(dir, `${loc}.json`), JSON.stringify(data, null, 2) + "\n");
}
console.log(`Applied ${Object.keys(spec).length} keys to ${Object.keys(touched).length} locales.`);
