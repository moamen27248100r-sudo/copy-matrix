// Usage: node scripts/i18n-fill.mjs <spec.json>
// spec: { "Full.dotted.key": [fr, es, pt, zh, hi, ur, id, vi, th, bn, sw] } -- fills those 11 locales only.
import fs from "node:fs";
import path from "node:path";
const ORDER = ["fr", "es", "pt", "zh", "hi", "ur", "id", "vi", "th", "bn", "sw"];
const spec = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
for (const [k, arr] of Object.entries(spec)) if (arr.length !== 11) { console.error(`BAD ${k}: ${arr.length}`); process.exit(1); }
const dir = path.join(process.cwd(), "src/messages");
for (const loc of ORDER) {
  const p = path.join(dir, `${loc}.json`);
  const data = JSON.parse(fs.readFileSync(p, "utf8"));
  for (const [full, arr] of Object.entries(spec)) {
    const parts = full.split(".");
    const leaf = parts.pop();
    let node = data;
    for (const part of parts) node = node[part] ??= {};
    node[leaf] = arr[ORDER.indexOf(loc)];
  }
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
}
console.log("filled", Object.keys(spec).length);
