// Unit tests for src/lib/money.ts: the one place money is written ("$10,000", "-$749.90").
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatMoney, formatUsdt } from "../src/lib/money.ts";

// The output is wrapped in a left-to-right isolate; strip it for readable assertions.
const plain = (s) => s.replace(/[⁦⁩]/g, "");
const m = (v, locale = "en", o) => plain(formatMoney(v, locale, o));

test("a whole amount drops its fraction", () => {
  assert.equal(m(10000), "$10,000");
  assert.equal(m(5000.0), "$5,000");
  assert.equal(m(0), "$0");
});

test("a real fraction keeps two digits", () => {
  assert.equal(m(2.31), "$2.31");
  assert.equal(m(2.5), "$2.50");
  assert.equal(m(1234.567), "$1,234.57");
});

test("a value that rounds to a whole amount is shown whole", () => {
  assert.equal(m(9.999), "$10");
  assert.equal(m(100.004), "$100");
});

test("negative sign goes before the dollar sign", () => {
  assert.equal(m(-749.9), "-$749.90");
  assert.equal(m(-1.12), "-$1.12");
  assert.equal(m(-0.001), "$0");
});

test("signed adds + for gains", () => {
  assert.equal(m(12.5, "en", { signed: true }), "+$12.50");
  assert.equal(m(-12.5, "en", { signed: true }), "-$12.50");
  assert.equal(m(0, "en", { signed: true }), "$0");
});

test("compact keeps K and M with the dollar sign", () => {
  assert.equal(m(1120, "en", { compact: true }), "$1.12K");
  assert.equal(m(-1120, "en", { compact: true }), "-$1.12K");
  assert.equal(m(1250000, "en", { compact: true }), "$1.25M");
  assert.equal(m(850, "en", { compact: true }), "$850");
});

test("Arabic keeps Latin digits and the left-to-right isolate", () => {
  const s = formatMoney(-749.9, "ar");
  assert.equal(s.startsWith("⁦"), true);
  assert.equal(s.endsWith("⁩"), true);
  assert.equal(plain(s), "-$749.90");
  assert.equal(m(10000, "ar"), "$10,000");
});

test("formatUsdt keeps the transfer currency for deposit and withdrawal screens", () => {
  assert.equal(plain(formatUsdt(1234.5, "en")), "1,234.50 USDT");
  assert.equal(plain(formatUsdt(-5, "en", { signed: true })), "-5.00 USDT");
});
