// One rule for every amount a customer types: a plain decimal number (digits, one dot or comma),
// positive, with at most `decimals` decimals (2 for dollars, 6 for USDT transfers), inside a
// minimum and a maximum. No exponents ("1e3"), no signs, no spaces, no "Infinity". The database
// has its own checks too; this gives the customer the reason before anything is sent.

export type MoneyProblem = "invalid" | "min" | "max" | "decimals";
export type MoneyCheck = { ok: true; value: number } | { ok: false; reason: MoneyProblem };

export function parseMoney(raw: unknown, opts: { min?: number; max?: number; decimals?: number } = {}): MoneyCheck {
  const { min = 0.01, max = 1_000_000_000, decimals = 2 } = opts;
  const text = (typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw : "").trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(text)) return { ok: false, reason: "invalid" };
  const [, frac = ""] = text.split(".");
  if (frac.length > decimals) return { ok: false, reason: "decimals" };
  const value = Number(text);
  if (!Number.isFinite(value) || value <= 0) return { ok: false, reason: "invalid" };
  if (value < min) return { ok: false, reason: "min" };
  if (value > max) return { ok: false, reason: "max" };
  return { ok: true, value };
}
