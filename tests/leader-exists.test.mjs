// leaderExists (src/lib/leader-exists.ts): the answer behind a real 404 for a missing leader.
import { test } from "node:test";
import assert from "node:assert/strict";
import { leaderExists } from "../src/lib/leader-exists.ts";

const ID = "ee5e22aa-e612-4dac-a537-a7045a0df592";

// A supabase stand-in answering a scripted sequence of { data, error } results.
function fake(results) {
  let calls = 0;
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: async () => results[Math.min(calls++, results.length - 1)],
  };
  return { client: { from: () => chain }, calls: () => calls };
}

test("an existing leader", async () => {
  const f = fake([{ data: { provider_id: ID }, error: null }]);
  assert.equal(await leaderExists(f.client, ID), true);
  assert.equal(f.calls(), 1);
});

test("a missing leader is false, with a single query", async () => {
  const f = fake([{ data: null, error: null }]);
  assert.equal(await leaderExists(f.client, ID), false);
  assert.equal(f.calls(), 1);
});

test("a malformed id is false without asking the database", async () => {
  const f = fake([{ data: { provider_id: ID }, error: null }]);
  for (const bad of ["", "not-a-uuid", "../x", ID + "x"]) assert.equal(await leaderExists(f.client, bad), false);
  assert.equal(f.calls(), 0);
});

test("one database error is retried and the second answer counts", async () => {
  const f = fake([{ data: null, error: { message: "connection reset" } }, { data: { provider_id: ID }, error: null }]);
  assert.equal(await leaderExists(f.client, ID), true);
  assert.equal(f.calls(), 2);
});

test("two database errors throw instead of pretending the leader is missing", async () => {
  const f = fake([{ data: null, error: { message: "boom" } }]);
  await assert.rejects(() => leaderExists(f.client, ID), /boom/);
  assert.equal(f.calls(), 2);
});
