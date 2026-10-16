// The risk badge has one source: provider_stats.risk_level (migration 0265, realized volatility),
// read through provider_cards. Every badge, every risk filter and every place that shows a leader
// reads that column; nothing in the app computes a risk level of its own.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const files = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|mjs)$/.test(f)) files.push(p);
  }
})("src");
const src = (p) => readFileSync(p, "utf8");

test("every RiskBadge is given the stored risk_level", () => {
  const uses = files.flatMap((p) => [...src(p).matchAll(/<RiskBadge\s+level=\{([^}]+)\}/g)].map((m) => [p, m[1].trim()]));
  assert.ok(uses.length >= 3, "badges found");
  for (const [p, expr] of uses) assert.match(expr, /\.risk_level$/, `${p}: ${expr}`);
});

test("the places that show a leader all use the badge or the one card", () => {
  const needs = {
    "src/components/LeaderCard.tsx": /<RiskBadge level=\{p\.risk_level\}/,
    "src/app/trader/[id]/page.tsx": /<RiskBadge level=\{provider\.risk_level\}/,
    "src/app/discover/compare/page.tsx": /<RiskBadge level=\{p\.risk_level\}/,
    "src/app/discover/page.tsx": /<LeaderCard/,
    "src/components/home/FeaturedLeadersSection.tsx": /<FeaturedLeaders/,
    "src/app/page.tsx": /<LeaderCard/,
  };
  for (const [p, re] of Object.entries(needs)) assert.match(src(p), re, p);
});

test("risk filters read the risk_level column", () => {
  const discover = src("src/app/discover/page.tsx");
  assert.match(discover, /\.eq\("risk_level", RISK_DB_VALUE\[risk\]\)/);
  assert.match(src("src/app/page.tsx"), /\.in\("risk_level", \[/);
  assert.match(src("src/components/home/FeaturedLeadersSection.tsx"), /risk_level/);
});

test("no code derives a risk level from a persona or its own formula", () => {
  // src/data holds fixed sample rows for the design previews, not a computation.
  for (const p of files.filter((f) => !/[\\/]data[\\/]/.test(f))) {
    const s = src(p);
    assert.doesNotMatch(s, /persona[^\n]*risk|risk[^\n]*persona/i, `${p} reads a persona's risk`);
    assert.doesNotMatch(s, /risk_level\s*[:=]\s*(?!.*risk_level)[^\n]*(vol|mdd|drawdown)/i, `${p} computes a risk level`);
  }
});
