// The browser only receives the translation namespaces client components read
// (src/i18n/client-messages.ts). This fails when a client component reads one that is not shipped.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { GLOBAL_CLIENT_NAMESPACES, ROUTE_CLIENT_NAMESPACES, pickMessages } from "../src/i18n/client-messages.ts";

const root = new URL("../src", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? files(p) : /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

// namespace -> files, for every component that calls useTranslations (client components, and the shared
// components they import, run in the browser)
const UNUSED_HOOKS = new Set(["lib/bio-translations.ts"]);
const used = new Map();
for (const f of files(root)) {
  const src = readFileSync(f, "utf8");
  if (UNUSED_HOOKS.has(relative(root, f).split("\\").join("/"))) continue;
  for (const m of src.matchAll(/useTranslations\(\s*["']([^"']+)["']\s*\)/g)) {
    if (!used.has(m[1])) used.set(m[1], []);
    used.get(m[1]).push(relative(root, f));
  }
}

const covers = (list, ns) => list.some((g) => ns === g || ns.startsWith(g + "."));

test("every namespace a client component reads is shipped globally or by its route", () => {
  const routed = Object.keys(ROUTE_CLIENT_NAMESPACES);
  const missing = [...used.keys()].filter((ns) => !covers(GLOBAL_CLIENT_NAMESPACES, ns) && !covers(routed, ns));
  assert.deepEqual(missing, [], "namespaces read by client components but never sent to the browser");
});

test("route-only namespaces are wrapped by their routes", () => {
  for (const [ns, route] of Object.entries(ROUTE_CLIENT_NAMESPACES)) {
    for (const file of Array.isArray(route) ? route : [route]) {
      const src = readFileSync(new URL("../" + file, import.meta.url), "utf8");
      assert.ok(src.includes("<ExtraMessages") && src.includes(`"${ns}"`), `${file} must wrap its client components in <ExtraMessages namespaces={["${ns}"]}>`);
    }
  }
});

test("no global namespace is also route-only", () => {
  for (const ns of Object.keys(ROUTE_CLIENT_NAMESPACES)) assert.ok(!GLOBAL_CLIENT_NAMESPACES.includes(ns), ns);
});

test("pickMessages keeps whole namespaces and nested ones, and ignores unknown ones", () => {
  const all = { A: { x: "1", y: { z: "2" } }, B: { q: "3" }, C: { n: { m: "4", k: "5" } } };
  assert.deepEqual(pickMessages(all, ["A"]), { A: { x: "1", y: { z: "2" } } });
  assert.deepEqual(pickMessages(all, ["C.n"]), { C: { n: { m: "4", k: "5" } } });
  assert.deepEqual(pickMessages(all, ["Nope", "B"]), { B: { q: "3" } });
  assert.deepEqual(pickMessages(all, []), {});
});
