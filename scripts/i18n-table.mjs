// Usage: node scripts/i18n-table.mjs <spec.json>
// spec: { "Namespace.sub": { key: [en, ar, fr, es, pt, zh, hi, ur, id, vi, th, bn, sw] } }
import fs from "node:fs";
import path from "node:path";
const ORDER = ["en", "ar", "fr", "es", "pt", "zh", "hi", "ur", "id", "vi", "th", "bn", "sw"];
const spec = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
for (const [ns, keys] of Object.entries(spec))
  for (const [k, arr] of Object.entries(keys))
    if (arr.length !== 13) { console.error(`BAD ${ns}.${k}: ${arr.length} values`); process.exit(1); }
const dir = path.join(process.cwd(), "src/messages");
for (const loc of ORDER) {
  const p = path.join(dir, `${loc}.json`);
  const data = JSON.parse(fs.readFileSync(p, "utf8"));
  for (const [ns, keys] of Object.entries(spec)) {
    let node = data;
    for (const part of ns.split(".")) node = node[part] ??= {};
    for (const [k, arr] of Object.entries(keys)) node[k] = arr[ORDER.indexOf(loc)];
  }
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
}
console.log("ok");
