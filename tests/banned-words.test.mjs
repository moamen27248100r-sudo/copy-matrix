// No customer-visible text says "demo", "simulated", "virtual" (or their equivalents in the other
// languages). The only exception is the account's own name: the Demo/Real switcher label and the
// badge on the balance card.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const EXEMPT = new Set(["Dashboard.accountDemo", "Dashboard.accountTypeShortDemo"]);
const INVISIBLE = /(^|\.)(id|keywords(\.\d+)?)$/; // FAQ ids and search keywords are never shown
const FLAG = {
  en: /bdemo|simulat|virtual/i, fr: /démo|demo|simul|virtuel/i, es: /bdemo|simul|virtual/i, pt: /bdemo|simul|virtua/i, zh: /演示|模拟|虚拟|demo/i,
  hi: /डेमो|सिमुल|वर्चुअल|आभासी|demo/i, ur: /ڈیمو|ورچوئل|فرضی|demo/i, id: /bdemo|simulasi|virtual/i, vi: /demo|mô phỏng|(?<![\p{L}])ảo(?![\p{L}])/iu, th: /เดโม|จำลอง|เสมือน|ทดลอง|demo/i,
  bn: /ডেমো|সিমুলে|ভার্চুয়াল|demo/i, sw: /bdemo|simulat|virtual|fedha pepe|kidhahania|dhahania|akaunti ya majaribio|jalada la majaribio/i, ar: /تجريب|محاكا|افتراض/,
};

test("no locale text uses the banned words (outside the account name)", () => {
  const bad = [];
  for (const [loc, re] of Object.entries(FLAG)) {
    const d = JSON.parse(fs.readFileSync(`src/messages/${loc}.json`, "utf8"));
    (function walk(o, p) {
      for (const [k, v] of Object.entries(o)) {
        const path = p + k;
        if (typeof v === "string") {
          if (!EXEMPT.has(path) && !INVISIBLE.test(path) && re.test(v)) bad.push(`${loc} ${path}`);
        } else if (v && typeof v === "object") walk(v, path + ".");
      }
    })(d, "");
  }
  assert.deepEqual(bad, []);
});

test("the security page's own text is clean too", () => {
  const s = fs.readFileSync("src/app/security/page.tsx", "utf8");
  assert.doesNotMatch(s, /demo|virtual|simulat|ديمو|ڈیمو|डेमो|ডেমো|เดโม|模拟|虚拟|ทดลอง/i);
});
