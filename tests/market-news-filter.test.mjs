// Paid press releases never appear as news, and a headline that names a market gets its tag.
import { test } from "node:test";
import assert from "node:assert/strict";
import { isPressRelease, relatedAsset } from "../src/lib/market-news.ts";

test("press-release sources and headlines are filtered out", () => {
  for (const source of ["Chainwire", "PR Newswire", "PRNewswire", "Business Wire", "GlobeNewswire", "Accesswire", "Sponsored", "EIN Presswire"]) {
    assert.equal(isPressRelease({ source, title: "Anything" }), true, source);
  }
  assert.equal(isPressRelease({ source: "Investing.com", title: "Press Release: Token launches" }), true);
  assert.equal(isPressRelease({ source: "Investing.com", title: "Sponsored: Join the presale" }), true);
  assert.equal(isPressRelease({ source: "Reuters", title: "Gold edges higher as dollar slips" }), false);
  assert.equal(isPressRelease({ source: "Investing.com", title: "Bitcoin climbs above $70,000" }), false);
});

test("a headline names the market it is about", () => {
  assert.deepEqual(relatedAsset("Bitcoin climbs above $70,000"), { symbol: "BTCUSDT", label: "BTC/USDT" });
  assert.equal(relatedAsset("Ethereum upgrade ships next week")?.symbol, "ETHUSDT");
  assert.equal(relatedAsset("Gold edges higher as dollar slips")?.symbol, "XAUUSD");
  assert.equal(relatedAsset("Euro slips after ECB comments")?.symbol, "EURUSD");
  assert.equal(relatedAsset("Wall Street ends mixed"), null);
});
