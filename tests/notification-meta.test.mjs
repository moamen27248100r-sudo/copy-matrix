// Notification list helpers: symbol writing, the icon kind of each type, and relative time.
import { test } from "node:test";
import assert from "node:assert/strict";
import { prettySymbol, notificationKind, relativeTime } from "../src/lib/notification-meta.ts";

test("asset symbols are written with a slash", () => {
  assert.equal(prettySymbol("ETHUSDT"), "ETH/USDT");
  assert.equal(prettySymbol("BINANCE:BTCUSDT"), "BTC/USDT");
  assert.equal(prettySymbol("EURUSD"), "EUR/USD");
  assert.equal(prettySymbol("XAUUSD"), "XAU/USD");
  assert.equal(prettySymbol("ETH/USDT"), "ETH/USDT");
  assert.equal(prettySymbol("US30"), "US30");
  assert.equal(prettySymbol(null), "");
});

test("every notification type has an icon kind", () => {
  assert.equal(notificationKind("copy_opened"), "copy");
  assert.equal(notificationKind("market_move"), "market");
  assert.equal(notificationKind("security_new_login"), "security");
  assert.equal(notificationKind("kyc_approved"), "verify");
  assert.equal(notificationKind("wallet_deposit_approved"), "wallet");
  assert.equal(notificationKind("lead_new_copier"), "leader");
  assert.equal(notificationKind("loss_alert"), "alert");
  assert.equal(notificationKind("auto_stop_copy"), "alert");
  assert.equal(notificationKind("followed_trade_opened"), "follow");
  assert.equal(notificationKind("something_new"), "other");
});

test("relative time reads in the language and falls back to a date after a month", () => {
  const now = Date.parse("2026-10-16T12:00:00Z");
  assert.match(relativeTime("2026-10-16T11:55:00Z", "en", now), /5 min/);
  assert.match(relativeTime("2026-10-16T09:00:00Z", "en", now), /3 hr/);
  assert.match(relativeTime("2026-10-14T12:00:00Z", "en", now), /2 days/);
  assert.match(relativeTime("2026-10-16T11:59:50Z", "en", now), /now/);
  assert.notEqual(relativeTime("2026-10-16T11:55:00Z", "ar", now), relativeTime("2026-10-16T11:55:00Z", "en", now));
  assert.match(relativeTime("2026-08-01T12:00:00Z", "en", now), /Aug/);
});
