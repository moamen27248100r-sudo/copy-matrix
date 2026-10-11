// Unit tests for src/lib/discover-paging.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyPageTarget } from "../src/lib/discover-paging.ts";

test("a page with rows, or the first page, is left alone", () => {
  assert.equal(emptyPageTarget({}, 3, 12, 100, 12), null);
  assert.equal(emptyPageTarget({}, 1, 0, 0, 12), null);
});

test("a page past the end goes to the last page and keeps the filters", () => {
  assert.equal(emptyPageTarget({ q: "ali", sort: "roi", page: "9" }, 9, 0, 30, 12), "/discover?q=ali&sort=roi&page=3");
});

test("an uncountable page goes to the first page", () => {
  assert.equal(emptyPageTarget({ page: "9999", risk: "low" }, 9999, 0, 0, 12), "/discover?risk=low");
  assert.equal(emptyPageTarget({ page: "50" }, 50, 0, 0, 12), "/discover");
});

test("a single page of results never gets a page parameter", () => {
  assert.equal(emptyPageTarget({ page: "4" }, 4, 0, 7, 12), "/discover");
});

test("error and array values are dropped", () => {
  assert.equal(emptyPageTarget({ error: "x", tag: ["a", "b"], page: "5" }, 5, 0, 24, 12), "/discover?page=2");
});
