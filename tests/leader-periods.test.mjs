// Leader periods: 1W 1M 3M 6M 1Y All (no 1D: leaders' records are kept per day), and the columns each reads.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PERIODS, parsePeriod, periodColumns, periodStats, sparkDays } from "../src/lib/leader-period.ts";

test("the leader periods include 1Y and never 1D", () => {
  assert.deepEqual([...PERIODS], ["7", "30", "90", "180", "365", "all"]);
  assert.equal(parsePeriod("365"), "365");
  assert.equal(parsePeriod("1"), "30"); // an unknown period falls back to the default
});

test("1Y reads its own columns and its own curve length", () => {
  assert.deepEqual(periodColumns("365"), { roi: "roi_365d", winRate: "win_rate_365d", mdd: "mdd_365d", sharpe: "sharpe_365d", trades: "trades_365d" });
  assert.equal(sparkDays("365"), 365);
  const row = { roi_365d: "41.2", win_rate_365d: "63.5", mdd_365d: "7.1", sharpe_365d: "1.4", trades_365d: 240 };
  const s = periodStats(row, "365");
  assert.equal(s.roi, 41.2);
  assert.equal(s.trades, 240);
  assert.equal(s.sufficient, true);
  assert.equal(periodStats({ ...row, trades_365d: 3 }, "365").roi, null, "too few trades: no figure");
});

test("every language has the 1Y button label and the profile table shows the year", () => {
  for (const l of ["ar", "en", "fr", "es", "pt", "zh", "hi", "ur", "id", "vi", "th", "bn", "sw"]) {
    assert.ok(JSON.parse(fs.readFileSync(`src/messages/${l}.json`, "utf8")).Discover.periodShort_365, l);
  }
  const page = fs.readFileSync("src/app/trader/[id]/page.tsx", "utf8");
  assert.match(page, /"365d"/);
  assert.match(page, /"periodYear"/);
});
