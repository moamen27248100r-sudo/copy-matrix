// The Google button asks the auth project whether Google sign-in is on before sending anyone there.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { googleFromSettings, isGoogleEnabled } from "../src/lib/google-auth.ts";

test("settings say whether Google is on", () => {
  assert.equal(googleFromSettings({ external: { google: true, email: true } }), true);
  assert.equal(googleFromSettings({ external: { google: false } }), false);
  assert.equal(googleFromSettings({ external: {} }), false);
  assert.equal(googleFromSettings({}), null);
  assert.equal(googleFromSettings(null), null);
});

test("isGoogleEnabled reads the settings endpoint and never throws", async () => {
  let seen = "";
  const ok = (body) => async (u, o) => {
    seen = `${u} ${o.headers.apikey}`;
    return { ok: true, json: async () => body };
  };
  assert.equal(await isGoogleEnabled("https://x.supabase.co/", "KEY", ok({ external: { google: false } })), false);
  assert.equal(seen, "https://x.supabase.co/auth/v1/settings KEY");
  assert.equal(await isGoogleEnabled("https://x.supabase.co", "KEY", ok({ external: { google: true } })), true);
  assert.equal(await isGoogleEnabled("https://x.supabase.co", "KEY", async () => ({ ok: false })), null);
  assert.equal(await isGoogleEnabled("https://x.supabase.co", "KEY", async () => { throw new Error("offline"); }), null);
});

test("the button shows a translated message instead of an error page", () => {
  const s = fs.readFileSync("src/components/GoogleSignInButton.tsx", "utf8");
  assert.match(s, /googleUnavailable/);
  assert.match(s, /googleSignInError/);
  assert.match(s, /role="alert"/);
  for (const l of ["ar", "en", "fr", "es", "pt", "zh", "hi", "ur", "id", "vi", "th", "bn", "sw"]) {
    const m = JSON.parse(fs.readFileSync(`src/messages/${l}.json`, "utf8")).Auth;
    assert.ok(m.googleUnavailable && m.googleSignInError, l);
  }
});
