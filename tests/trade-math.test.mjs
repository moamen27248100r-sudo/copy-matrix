// Unit tests for the shared trade math (src/lib/pip-specs.ts), which
// mirrors the database rules in 0215/0217. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deriveCloseTrigger,
  levelsValid,
  resolveLevels,
  tradeDeltaPoints,
  tradeProfitUsd,
  tradeReturnPct,
} from "../src/lib/pip-specs.ts";

const sign = (n) => Math.sign(n);

test("buy in profit: $, %, Δ all positive", () => {
  const usd = tradeProfitUsd("XAUUSD", "buy", 4000, 4040, 1);
  assert.equal(usd, 4000); // 400 pips x $10 x 1 lot
  assert.ok(tradeReturnPct("buy", 4000, 4040) > 0);
  assert.equal(tradeDeltaPoints("buy", 4000, 4040), 40);
  assert.equal(deriveCloseTrigger("buy", 4000, 4040, 3950, 4100, "timeout"), "timeout");
});

test("buy at a loss: $, %, Δ all negative", () => {
  const usd = tradeProfitUsd("XAUUSD", "buy", 4000, 3980, 0.5);
  assert.equal(usd, -1000);
  assert.equal(sign(tradeReturnPct("buy", 4000, 3980)), -1);
  assert.equal(tradeDeltaPoints("buy", 4000, 3980), -20);
});

test("sell in profit: $, %, Δ all positive", () => {
  assert.equal(tradeProfitUsd("BTCUSDT", "sell", 80000, 79000, 2), 2000);
  assert.ok(tradeReturnPct("sell", 80000, 79000) > 0);
  assert.equal(tradeDeltaPoints("sell", 80000, 79000), 1000);
});

test("sell at a loss: $, %, Δ all negative", () => {
  assert.equal(tradeProfitUsd("EURUSD", "sell", 1.1, 1.101, 1), -100);
  assert.equal(sign(tradeReturnPct("sell", 1.1, 1.101)), -1);
  assert.ok(tradeDeltaPoints("sell", 1.1, 1.101) < 0);
});

test("close at T/P is a 'tp' win (buy and sell)", () => {
  assert.equal(deriveCloseTrigger("buy", 4000, 4100, 3950, 4100, "timeout"), "tp");
  assert.equal(deriveCloseTrigger("sell", 4000, 3900, 4050, 3900, "timeout"), "tp");
  assert.ok(tradeReturnPct("sell", 4000, 3900) > 0);
});

test("close at S/L is an 'sl' loss (buy and sell)", () => {
  assert.equal(deriveCloseTrigger("buy", 4000, 3950, 3950, 4100, "timeout"), "sl");
  assert.equal(deriveCloseTrigger("sell", 4000, 4050, 4050, 3900, "timeout"), "sl");
  assert.ok(tradeReturnPct("sell", 4000, 4050) < 0);
});

test("a stored 'tp'/'sl' the prices don't support is not kept", () => {
  // labelled tp but closed at a loss far from the target
  assert.notEqual(deriveCloseTrigger("buy", 4000, 3980, 3950, 4100, "tp"), "tp");
  // labelled sl but closed in profit
  assert.notEqual(deriveCloseTrigger("sell", 4000, 3990, 4050, 3900, "sl"), "sl");
});

test("trade without S/L and T/P", () => {
  assert.equal(deriveCloseTrigger("buy", 4000, 4010, null, null, null), "manual");
  assert.equal(deriveCloseTrigger("buy", 4000, 4000.5, null, null, "timeout"), "breakeven");
  assert.equal(deriveCloseTrigger("sell", 4000, 4010, null, null, "margin_call"), "margin_call");
  assert.ok(levelsValid("sell", 4000, null, null));
  assert.deepEqual(resolveLevels("buy", 4000, null, null), { stopLoss: null, takeProfit: null });
});

test("S/L and T/P placement", () => {
  assert.ok(levelsValid("buy", 4000, 3950, 4100));
  assert.ok(levelsValid("sell", 4000, 4050, 3900));
  assert.ok(!levelsValid("buy", 4000, 4100, 3950)); // swapped
  assert.ok(!levelsValid("sell", 4000, 3950, 4100)); // swapped
  assert.ok(!levelsValid("buy", 4000, -5, null)); // non-positive
  // swapped columns are still read back the right way round
  assert.deepEqual(resolveLevels("buy", 4000, 4100, 3950), { stopLoss: 3950, takeProfit: 4100 });
});
