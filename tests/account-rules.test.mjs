// Unit tests for the account rules: password policy, money input, phone numbers, where a sign-up
// leads, and that the removed account-type page is gone everywhere.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { passwordIssue, isBreachedPassword, PASSWORD_MIN } from "../src/lib/password-policy.ts";
import { parseMoney } from "../src/lib/validate-money.ts";
import { toE164 } from "../src/lib/phone.ts";
import { signupOutcome } from "../src/lib/signup-outcome.ts";
import { copyAmountIssue } from "../src/lib/copy-amount.ts";

test("a password needs 8 characters, must not be common and must not be the e-mail", () => {
  assert.equal(PASSWORD_MIN, 8);
  assert.equal(passwordIssue("abc123", null), "short");
  assert.equal(passwordIssue("1234567", null), "short");
  assert.equal(passwordIssue("password", null), "common");
  assert.equal(passwordIssue("Password123", null), "common");
  assert.equal(passwordIssue("aaaaaaaaaa", null), "common");
  assert.equal(passwordIssue("someone.long@x.com", "someone.long@x.com"), "email");
  assert.equal(passwordIssue("someonelong", "someonelong@x.com"), "email");
  assert.equal(passwordIssue("tq9#Lm2vXz", "someone@x.com"), null);
});

test("the leaked-password check sends only the first 5 hash characters and reads the answer", async () => {
  const realFetch = globalThis.fetch;
  let url = "";
  try {
    const sha1 = createHash("sha1").update("password1").digest("hex").toUpperCase();
    globalThis.fetch = async (u) => {
      url = String(u);
      return new Response(`${sha1.slice(5)}:99\r\n0000000000000000000000000000000000A:0\r\n`);
    };
    assert.equal(await isBreachedPassword("password1"), true);
    assert.ok(url.endsWith("/range/" + sha1.slice(0, 5)), url);
    assert.ok(!url.toUpperCase().includes(sha1.slice(5, 15)), "the rest of the hash never leaves the server");
    globalThis.fetch = async () => new Response("0000000000000000000000000000000000A:1\r\n");
    assert.equal(await isBreachedPassword("tq9#Lm2vXz"), false);
    globalThis.fetch = async () => {
      throw new Error("offline");
    };
    assert.equal(await isBreachedPassword("tq9#Lm2vXz"), null, "when the service is down the local list protects");
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("parseMoney accepts plain positive amounts only", () => {
  assert.deepEqual(parseMoney("10"), { ok: true, value: 10 });
  assert.deepEqual(parseMoney("10,5"), { ok: true, value: 10.5 });
  assert.deepEqual(parseMoney(" 0.01 "), { ok: true, value: 0.01 });
  for (const bad of ["", "-5", "+5", "1e3", "Infinity", "NaN", "5 0", "0", "0.00", "abc", null, undefined, "١٢"]) {
    assert.equal(parseMoney(bad).ok, false, `rejects ${String(bad)}`);
  }
  assert.equal(parseMoney("1.234").reason, "decimals");
  assert.equal(parseMoney("1.234567", { decimals: 6 }).ok, true);
  assert.equal(parseMoney("1.2345678", { decimals: 6 }).reason, "decimals");
  assert.equal(parseMoney("0.5", { min: 1 }).reason, "min");
  assert.equal(parseMoney("2000000", { max: 1_000_000 }).reason, "max");
});

test("the copy amount hint also catches odd decimals", () => {
  assert.equal(copyAmountIssue(10.123, 5, 1000, "10.123"), "decimals");
  assert.equal(copyAmountIssue(10.12, 5, 1000, "10.12"), null);
});

test("phone numbers become E.164 or are refused", () => {
  assert.equal(toE164("+20", "EG", "01012345678"), "+201012345678");
  assert.equal(toE164("+1", "US", "(415) 555-2671"), "+14155552671");
  assert.equal(toE164("+20", "EG", "123"), null);
  assert.equal(toE164("20", "EG", "1012345678"), null);
  assert.equal(toE164("+20", "EG", ""), null);
});

test("sign-up goes straight to the dashboard, or back to the trader being copied", () => {
  const ok = (session) => ({ error: null, data: { session, user: { identities: [{}] } } });
  assert.deepEqual(signupOutcome(ok({ access_token: "x" }), null), { kind: "go", to: "/dashboard" });
  assert.deepEqual(signupOutcome(ok({ access_token: "x" }), "/trader/abc"), { kind: "go", to: "/trader/abc" });
  assert.equal(signupOutcome(ok(null), null).kind, "go"); // a project that wants a confirmation first
  const dup = { error: { message: "User already registered" }, data: { session: null, user: null } };
  assert.deepEqual(signupOutcome(dup, null), { kind: "back", code: "email_taken" });
  const hidden = { error: null, data: { session: null, user: { identities: [] } } };
  assert.deepEqual(signupOutcome(hidden, null), { kind: "back", code: "email_taken" });
  const other = { error: { message: "boom" }, data: { session: null, user: null } };
  assert.equal(signupOutcome(other, null).code, "generic");
});

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx?|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}

test("the account-type page and the signup steps are gone from the code", () => {
  assert.ok(!fs.existsSync("src/app/onboarding/account-type"), "page folder removed");
  const hits = [];
  for (const f of walk("src")) {
    const s = fs.readFileSync(f, "utf8");
    if (/onboarding\/account-type|AuthSteps|ClearSignupDraft/.test(s)) hits.push(f);
  }
  assert.deepEqual(hits, []);
});

test("sign-up asks only for e-mail and password", () => {
  const form = fs.readFileSync("src/components/SignupForm.tsx", "utf8");
  assert.ok(!/name="(phone|name|fullName|displayName)"/.test(form), "no name or phone field in the sign-up form");
  assert.match(form, /name="email"/);
  assert.match(form, /name="password"/);
});
