// Static link audit: every internal link / redirect / push target written anywhere in the customer
// app must resolve to a real route of the app (a page or a route handler), and every route that
// the navigation points at must exist. Fails on any link that would end in a 404.
//
// What is read: href="/..." and href={`/...`} attributes, <Link href>, redirect("/..."),
// router.push/replace("/..."), NextResponse.redirect(new URL("/...")), and the shared navigation
// tables (menus, bottom nav, footer).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const APP = join("src", "app");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// ---- routes of the app, from the folder structure
const routePatterns = [];
for (const file of walk(APP)) {
  if (!/(^|[\\/])(page\.tsx|route\.ts)$/.test(file)) continue;
  let dir = relative(APP, file).split(sep).slice(0, -1);
  dir = dir.filter((seg) => !/^\(.*\)$/.test(seg)); // route groups
  const regex = "^/" + dir.map((seg) => (/^\[\.\.\..+\]$/.test(seg) ? ".+" : /^\[.+\]$/.test(seg) ? "[^/]+" : seg.replace(/[.*+?^${}()|\\]/g, "\\$&"))).join("/") + "/?$";
  routePatterns.push(new RegExp(regex.replace("//", "/")));
}
routePatterns.push(/^\/$/);
const routeExists = (path) => routePatterns.some((re) => re.test(path));

// ---- links written in source
const SRC_FILES = walk("src").filter((f) => /\.(tsx|ts)$/.test(f) && !f.includes(`${sep}messages${sep}`));
const LINK_RES = [
  /href=\{?`(\/[^`]*)`\}?/g, // template literals
  /href=\{?"(\/[^"]*)"\}?/g,
  /href:\s*`(\/[^`]*)`/g,
  /href:\s*"(\/[^"]*)"/g,
  /redirect\(\s*`(\/[^`]*)`/g,
  /redirect\(\s*"(\/[^"]*)"/g,
  /router\.(?:push|replace)\(\s*`(\/[^`]*)`/g,
  /router\.(?:push|replace)\(\s*"(\/[^"]*)"/g,
  /new URL\(\s*`(\/[^`]*)`/g,
  /new URL\(\s*"(\/[^"]*)"/g,
];

function normalise(raw) {
  // A value glued to a path ("/signup/check-email${query}") is a query string, not a segment.
  let p = raw.replace(/(?<=[^/])\$\{[^}]*\}/g, "").replace(/\$\{[^}]*\}/g, "x"); // other dynamic parts become a placeholder segment
  p = p.split("#")[0].split("?")[0];
  return p || "/";
}

test("every internal link points at an existing route", () => {
  const broken = new Map();
  for (const file of SRC_FILES) {
    if (file.includes(`${sep}admin${sep}`) || file.includes(`${sep}lead${sep}`) && false) continue;
    const src = readFileSync(file, "utf8");
    for (const re of LINK_RES) {
      for (const m of src.matchAll(re)) {
        const raw = m[1];
        if (raw.startsWith("//") || raw === "/") continue;
        const path = normalise(raw);
        if (path === "/" || routeExists(path)) continue;
        // Static assets and files served from /public or generated routes
        if (/\.(png|jpg|jpeg|svg|ico|webp|txt|xml|webmanifest)$/.test(path) || path.startsWith("/_next")) continue;
        const key = `${path}   <-  ${relative(".", file).split(sep).join("/")}`;
        broken.set(key, true);
      }
    }
  }
  assert.deepEqual([...broken.keys()], [], `Links to routes that do not exist:\n${[...broken.keys()].join("\n")}`);
});

test("the main navigation lists only existing destinations", () => {
  const targets = [
    "/dashboard", "/discover", "/copies", "/trades", "/portfolio", "/settings", "/notifications", "/notifications/preferences",
    "/kyc", "/account/security", "/markets", "/profit-share-history", "/become-lead-trader", "/support", "/legal/terms",
    "/legal/privacy", "/risk-disclosure", "/about", "/security", "/login", "/signup", "/portfolio/deposit", "/portfolio/withdraw",
    "/portfolio/history", "/lead", "/lead/followers", "/trades/export", "/discover/compare", "/forgot-password",
  ];
  const missing = targets.filter((t) => !routeExists(t));
  assert.deepEqual(missing, [], `Missing routes: ${missing.join(", ")}`);
});
