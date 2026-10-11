// Copy refusal rules (src/lib/copy-rules.ts), in both states of the deposits switch.
import { test } from "node:test";
import assert from "node:assert/strict";
import { copyRefusal, COPY_REFUSAL_CODES } from "../src/lib/copy-rules.ts";

const base = {
  isStarting: true,
  depositsEnabled: false,
  accountType: "real",
  leaderSimulated: true,
  leaderAcceptingFollowers: true,
  kycApproved: false,
};

test("deposits off: real and demo accounts copy any leader without extra conditions", () => {
  for (const accountType of ["real", "demo"]) {
    for (const leaderSimulated of [true, false]) {
      assert.equal(copyRefusal({ ...base, accountType, leaderSimulated }), null, `${accountType}/${leaderSimulated ? "sim" : "real"}`);
    }
  }
});

test("deposits off: no KYC is asked", () => {
  assert.equal(copyRefusal({ ...base, kycApproved: false, leaderSimulated: false }), null);
});

test("a leader that is not accepting followers refuses a new copy in both states", () => {
  for (const depositsEnabled of [false, true]) {
    assert.equal(
      copyRefusal({ ...base, depositsEnabled, accountType: "demo", leaderSimulated: false, leaderAcceptingFollowers: false }),
      "not_accepting_followers",
    );
  }
});

test("a leader that is not accepting followers still lets a running copy be edited", () => {
  assert.equal(copyRefusal({ ...base, isStarting: false, leaderSimulated: false, leaderAcceptingFollowers: false }), null);
});

test("no profile row (null/undefined) counts as accepting", () => {
  assert.equal(copyRefusal({ ...base, leaderSimulated: false, leaderAcceptingFollowers: null }), null);
  assert.equal(copyRefusal({ ...base, leaderSimulated: false, leaderAcceptingFollowers: undefined }), null);
});

test("deposits on: a real account cannot copy a simulated leader", () => {
  assert.equal(copyRefusal({ ...base, depositsEnabled: true, kycApproved: true }), "leader_demo_only");
});

test("deposits on: a demo account still copies a simulated leader", () => {
  assert.equal(copyRefusal({ ...base, depositsEnabled: true, accountType: "demo" }), null);
});

test("deposits on: a real account needs an approved KYC to start a copy of a real leader", () => {
  const real = { ...base, depositsEnabled: true, leaderSimulated: false };
  assert.equal(copyRefusal({ ...real, kycApproved: false }), "kyc_required");
  assert.equal(copyRefusal({ ...real, kycApproved: true }), null);
});

test("deposits on: KYC is not asked to edit a running copy, nor of a demo account", () => {
  const real = { ...base, depositsEnabled: true, leaderSimulated: false };
  assert.equal(copyRefusal({ ...real, isStarting: false, kycApproved: false }), null);
  assert.equal(copyRefusal({ ...real, accountType: "demo", kycApproved: false }), null);
});

test("refusal reasons map to the database error codes", () => {
  assert.deepEqual(COPY_REFUSAL_CODES, { leader_demo_only: "CM050", not_accepting_followers: "CM051", kyc_required: "CM052" });
});
