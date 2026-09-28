// Usage: node scripts/add-i18n.mjs <file.json>
// File shape: { "Namespace.sub": { "key": { "en": "...", "ar": "..." } } }
// Adds keys to all locale files; locales other than en/ar fall back to English.
import fs from "node:fs";
import path from "node:path";
const spec = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const dir = path.join(process.cwd(), "src/messages");
for (const f of fs.readdirSync(dir)) {
  const loc = f.replace(".json", "");
  const p = path.join(dir, f);
  const data = JSON.parse(fs.readFileSync(p, "utf8"));
  for (const [ns, keys] of Object.entries(spec)) {
    let node = data;
    for (const part of ns.split(".")) node = node[part] ??= {};
    for (const [k, v] of Object.entries(keys)) node[k] = v[loc] ?? v.en;
  }
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
}
