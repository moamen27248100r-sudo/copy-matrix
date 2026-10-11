// Read-only check of the live database after migration 0252, through the public (anon) API only:
//
//   node scripts/verify-migration-0252.mjs
//
// Confirms the hidden columns are no longer returned to the anon key and the public ones still are.
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!base || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY missing");

const results = [];
const ok = (name, pass, extra = "") => results.push({ name, pass, extra });
const get = async (path) => {
  const r = await fetch(`${base}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  let body = null;
  try {
    body = await r.json();
  } catch {}
  return { status: r.status, body };
};

for (const col of ["predetermined_win", "needs_review", "review_reasons", "is_margin_call", "created_by_admin"]) {
  const r = await get(`signals?select=${col}&limit=1`);
  ok(`signals.${col} is not readable`, r.status === 401 || r.status === 403 || r.body?.code === "42501", `status ${r.status}`);
}
const star = await get("signals?select=*&limit=1");
ok("signals select=* is refused", star.status === 401 || star.status === 403 || star.body?.code === "42501", `status ${star.status}`);

const pub = await get("signals?select=id,provider_id,symbol,side,entry_price,exit_price,status,opened_at,closed_at,pnl_usd,return_pct&limit=1");
ok("public signal columns still readable", pub.status === 200 && Array.isArray(pub.body) && pub.body.length === 1, `status ${pub.status}`);

const cards = await get("provider_cards?select=*&limit=1");
ok("provider_cards readable", cards.status === 200 && Array.isArray(cards.body) && cards.body.length === 1, `status ${cards.status}`);
ok("provider_cards has no is_simulated", cards.status === 200 && cards.body?.[0] && !("is_simulated" in cards.body[0]));

const prov = await get("providers?select=persona&limit=1");
ok("providers.persona is not readable by anon", prov.status === 401 || prov.status === 403 || (prov.status === 200 && prov.body.length === 0) || prov.body?.code === "42501");

const sw = await fetch(`${base}/rest/v1/rpc/deposits_enabled`, {
  method: "POST",
  headers: { apikey: key, Authorization: `Bearer ${key}`, "content-type": "application/json" },
  body: "{}",
});
ok("deposits_enabled() is false", sw.status === 200 && (await sw.json()) === false, `status ${sw.status}`);

for (const r of results) console.log((r.pass ? "PASS " : "FAIL ") + r.name + (r.pass ? "" : `  -> ${r.extra}`));
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} passed`);
process.exit(results.every((r) => r.pass) ? 0 : 1);
