// Unit tests for src/lib/uuid.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { isUuid } from "../src/lib/uuid.ts";

test("accepts a UUID in either case", () => {
  assert.equal(isUuid("ee5e22aa-e612-4dac-a537-a7045a0df592"), true);
  assert.equal(isUuid("EE5E22AA-E612-4DAC-A537-A7045A0DF592"), true);
});

test("rejects anything else", () => {
  for (const v of ["", "abc", "../../etc", "ee5e22aa-e612-4dac-a537-a7045a0df59", "ee5e22aa-e612-4dac-a537-a7045a0df592/x", "ee5e22aa-e612-4dac-a537-a7045a0df592?x=1", null, undefined, 5]) {
    assert.equal(isUuid(v), false, String(v));
  }
});
