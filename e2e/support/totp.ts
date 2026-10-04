import { createHmac } from "node:crypto";

// RFC 6238 TOTP (SHA-1, 6 digits, 30 s) so the scenario can complete the
// two-factor flow without an authenticator app.
function base32Decode(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of input.replace(/[\s=]/g, "").toUpperCase()) bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

export function totp(secret: string, at = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const h = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  const code = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(code % 1_000_000).padStart(6, "0");
}

// Waits until the current 30 s window is not about to roll over, so a code
// computed now is still valid when the server checks it.
export async function freshWindow(): Promise<void> {
  const left = 30_000 - (Date.now() % 30_000);
  if (left < 4_000) await new Promise((r) => setTimeout(r, left + 200));
}
