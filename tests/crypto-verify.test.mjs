// On-chain deposit verification (src/lib/crypto/verify.ts) against recorded-shape API responses:
// TronGrid for TRC20, Etherscan API V2 / JSON-RPC for BEP20 and ERC20. No network access. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyDeposit } from "../src/lib/crypto/verify.ts";
import {
  CHAINS,
  isValidAddress,
  normalizeTxHash,
  tronAddressChecksumOk,
  tronAddressToHex,
  unitsToDecimal,
} from "../src/lib/crypto/networks.ts";

const HASH = "a".repeat(64);
const OUR_EVM = "0x1111111111111111111111111111111111111111";
const OTHER_EVM = "0x2222222222222222222222222222222222222222";
const SENDER_EVM = "0x3333333333333333333333333333333333333333";
const OUR_TRON = "TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7";
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const pad = (hex20) => "0x" + "0".repeat(24) + hex20.replace(/^0x/, "").toLowerCase();
const word = (n) => "0x" + BigInt(n).toString(16).padStart(64, "0");

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// Etherscan V2 proxy: routes on ?action=, answers in JSON-RPC shape.
function etherscan({ receipt, latest = "0x64" }) {
  const calls = [];
  const f = async (url) => {
    const u = new URL(url);
    calls.push(u.searchParams.get("action") + ":" + u.searchParams.get("chainid"));
    if (u.searchParams.get("action") === "eth_getTransactionReceipt") return json({ jsonrpc: "2.0", id: 1, result: receipt });
    if (u.searchParams.get("action") === "eth_blockNumber") return json({ jsonrpc: "2.0", id: 1, result: latest });
    return json({ status: "0", message: "NOTOK", result: "unknown" });
  };
  return { f, calls };
}

const usdtLog = (network, to, units, contract = CHAINS[network].usdtContract) => ({
  address: contract.toLowerCase(),
  topics: [TRANSFER, pad(SENDER_EVM), pad(to)],
  data: word(units),
});

const receiptWith = (logs, extra = {}) => ({ status: "0x1", blockNumber: "0x5b", to: CHAINS.ERC20.usdtContract, logs, ...extra });

test("ERC20: a valid USDT transfer to our address is found with chain amount and confirmations", async () => {
  const { f, calls } = etherscan({ receipt: receiptWith([usdtLog("ERC20", OUR_EVM, 250_500000)]) });
  const r = await verifyDeposit("ERC20", HASH, OUR_EVM, { etherscanApiKey: "k", fetch: f });
  assert.deepEqual(r, { state: "found", amount: "250.5", confirmations: 10, from: SENDER_EVM, block: 91 });
  assert.deepEqual(calls, ["eth_getTransactionReceipt:1", "eth_blockNumber:1"]);
});

test("BEP20: 18 decimals and chain id 56; several transfers to us are summed", async () => {
  const one = BigInt("1000000000000000000");
  const { f, calls } = etherscan({ receipt: receiptWith([usdtLog("BEP20", OUR_EVM, 40n * one), usdtLog("BEP20", OUR_EVM, one / 2n)]) });
  const r = await verifyDeposit("BEP20", HASH, OUR_EVM, { etherscanApiKey: "k", fetch: f });
  assert.equal(r.state, "found");
  assert.equal(r.amount, "40.5");
  assert.ok(calls.every((c) => c.endsWith(":56")));
});

test("wrong recipient: USDT sent to someone else", async () => {
  const { f } = etherscan({ receipt: receiptWith([usdtLog("ERC20", OTHER_EVM, 100_000000)]) });
  assert.deepEqual(await verifyDeposit("ERC20", HASH, OUR_EVM, { etherscanApiKey: "k", fetch: f }), { state: "failed", reason: "wrong_recipient" });
});

test("wrong contract: a look-alike token (or the native coin) sent to our address", async () => {
  const fake = "0x9999999999999999999999999999999999999999";
  const { f } = etherscan({ receipt: receiptWith([usdtLog("ERC20", OUR_EVM, 100_000000, fake)]) });
  assert.deepEqual(await verifyDeposit("ERC20", HASH, OUR_EVM, { etherscanApiKey: "k", fetch: f }), { state: "failed", reason: "wrong_token" });
  const native = etherscan({ receipt: receiptWith([], { to: OUR_EVM }) });
  assert.deepEqual(await verifyDeposit("ERC20", HASH, OUR_EVM, { etherscanApiKey: "k", fetch: native.f }), { state: "failed", reason: "wrong_token" });
  // A BEP20 USDT transfer is not ERC20 USDT: the contract must match the chosen network.
  const cross = etherscan({ receipt: receiptWith([usdtLog("BEP20", OUR_EVM, 100)]) });
  assert.deepEqual(await verifyDeposit("ERC20", HASH, OUR_EVM, { etherscanApiKey: "k", fetch: cross.f }), { state: "failed", reason: "wrong_token" });
});

test("too few confirmations are reported as found with the current count (the database waits)", async () => {
  const { f } = etherscan({ receipt: receiptWith([usdtLog("ERC20", OUR_EVM, 50_000000)]), latest: "0x5c" });
  const r = await verifyDeposit("ERC20", HASH, OUR_EVM, { etherscanApiKey: "k", fetch: f });
  assert.equal(r.state, "found");
  assert.equal(r.confirmations, 2);
});

test("not yet mined, reverted, and provider errors", async () => {
  const pending = etherscan({ receipt: null });
  assert.deepEqual(await verifyDeposit("ERC20", HASH, OUR_EVM, { etherscanApiKey: "k", fetch: pending.f }), { state: "not_found" });
  const reverted = etherscan({ receipt: receiptWith([usdtLog("ERC20", OUR_EVM, 1)], { status: "0x0" }) });
  assert.deepEqual(await verifyDeposit("ERC20", HASH, OUR_EVM, { etherscanApiKey: "k", fetch: reverted.f }), { state: "failed", reason: "tx_failed" });
  const badKey = async () => json({ status: "0", message: "NOTOK", result: "Invalid API Key" });
  assert.equal((await verifyDeposit("ERC20", HASH, OUR_EVM, { etherscanApiKey: "x", fetch: badKey })).state, "error");
  const down = async () => new Response("bad gateway", { status: 502 });
  assert.equal((await verifyDeposit("BEP20", HASH, OUR_EVM, { etherscanApiKey: "k", fetch: down })).state, "error");
  assert.equal((await verifyDeposit("BEP20", HASH, OUR_EVM, { fetch: down })).state, "error"); // no key at all
});

test("a JSON-RPC endpoint (BSC_RPC_URL) can replace Etherscan for a network", async () => {
  const methods = [];
  const f = async (url, init) => {
    assert.equal(url, "https://rpc.example/bsc");
    const { method } = JSON.parse(init.body);
    methods.push(method);
    return json({ jsonrpc: "2.0", id: 1, result: method === "eth_blockNumber" ? "0x5b" : receiptWith([usdtLog("BEP20", OUR_EVM, BigInt("20000000000000000000"))]) });
  };
  const r = await verifyDeposit("BEP20", HASH, OUR_EVM, { rpcUrls: { BEP20: "https://rpc.example/bsc" }, fetch: f });
  assert.deepEqual(r, { state: "found", amount: "20", confirmations: 1, from: SENDER_EVM, block: 91 });
  assert.deepEqual(methods, ["eth_getTransactionReceipt", "eth_blockNumber"]);
});

// TronGrid ------------------------------------------------------------------------------------
function trongrid({ info, tx = {}, latest = 1020 }) {
  const seen = [];
  const f = async (url, init) => {
    const path = new URL(url).pathname;
    seen.push({ path, key: init.headers["TRON-PRO-API-KEY"] });
    if (path === "/wallet/gettransactioninfobyid") return json(info);
    if (path === "/wallet/gettransactionbyid") return json(tx);
    if (path === "/wallet/getblock") return json({ block_header: { raw_data: { number: latest } } });
    return json({}, 404);
  };
  return { f, seen };
}
const ourHex = tronAddressToHex(OUR_TRON);
const usdtHex = tronAddressToHex(CHAINS.TRC20.usdtContract);
const tronLog = (toHex, units, contractHex = usdtHex) => ({
  address: contractHex,
  topics: [TRANSFER.slice(2), "0".repeat(24) + "4".repeat(40), "0".repeat(24) + toHex],
  data: BigInt(units).toString(16).padStart(64, "0"),
});
const tronInfo = (logs, extra = {}) => ({ id: HASH, blockNumber: 1001, receipt: { result: "SUCCESS" }, log: logs, ...extra });

test("TRC20: valid transfer, API key header, confirmations from the latest block", async () => {
  assert.equal(usdtHex, "a614f803b6fd780986a42c78ec9c7f77e6ded13c");
  const { f, seen } = trongrid({ info: tronInfo([tronLog(ourHex, 1_234_560000)]) });
  const r = await verifyDeposit("TRC20", HASH, OUR_TRON, { trongridApiKey: "tk", fetch: f });
  assert.deepEqual(r, { state: "found", amount: "1234.56", confirmations: 20, from: "41" + "4".repeat(40), block: 1001 });
  assert.ok(seen.every((s) => s.key === "tk"));
});

test("TRC20: wrong recipient, wrong contract, TRX sent directly, failed, not found", async () => {
  const other = "5".repeat(40);
  const cfg = (info, tx) => ({ fetch: trongrid({ info, tx }).f });
  assert.deepEqual(await verifyDeposit("TRC20", HASH, OUR_TRON, cfg(tronInfo([tronLog(other, 5)]))), { state: "failed", reason: "wrong_recipient" });
  assert.deepEqual(await verifyDeposit("TRC20", HASH, OUR_TRON, cfg(tronInfo([tronLog(ourHex, 5, "6".repeat(40))]))), { state: "failed", reason: "wrong_token" });
  const trx = { raw_data: { contract: [{ parameter: { value: { to_address: "41" + ourHex } } }] } };
  assert.deepEqual(await verifyDeposit("TRC20", HASH, OUR_TRON, cfg(tronInfo([]), trx)), { state: "failed", reason: "wrong_token" });
  assert.deepEqual(await verifyDeposit("TRC20", HASH, OUR_TRON, cfg(tronInfo([tronLog(ourHex, 5)], { result: "FAILED", receipt: { result: "REVERT" } }))), { state: "failed", reason: "tx_failed" });
  assert.deepEqual(await verifyDeposit("TRC20", HASH, OUR_TRON, cfg({})), { state: "not_found" });
});

test("address and hash helpers", async () => {
  assert.ok(isValidAddress("TRC20", OUR_TRON));
  assert.ok(!isValidAddress("TRC20", OUR_EVM));
  assert.ok(isValidAddress("BEP20", OUR_EVM) && isValidAddress("ERC20", OUR_EVM));
  assert.ok(!isValidAddress("ERC20", "0x123"));
  assert.ok(await tronAddressChecksumOk(OUR_TRON));
  assert.ok(await tronAddressChecksumOk(CHAINS.TRC20.usdtContract));
  assert.ok(!(await tronAddressChecksumOk("TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU8")));
  assert.equal(normalizeTxHash("  0x" + "AB".repeat(32) + " "), "ab".repeat(32));
  assert.equal(normalizeTxHash("xyz"), null);
  assert.equal(unitsToDecimal(1n, 6), "0.000001");
  assert.equal(unitsToDecimal(10_000000n, 6), "10");
});
