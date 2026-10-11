// Number and date formats of a trade row, in the MetaTrader 5 history style:
// "2 537.15", "-389.58", "4398.543", "2026.10.09 02:57:30". Locale-independent
// on purpose -- every trade list reads the same in every language.

const NBSP = " ";

// Profit / loss: thousands grouped by a space, two decimals, "-" for a loss,
// no "+" and no currency.
export function formatTradePnl(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  const abs = Math.abs(n).toFixed(2);
  const [int, frac] = abs.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const negative = n < 0 && Number(abs) !== 0;
  return `${negative ? "-" : ""}${grouped}.${frac}`;
}

// Fixed decimals per instrument, like a trading terminal quotes them; any
// other symbol keeps the platform's generic precision (up to 4, trimmed).
const PRICE_DECIMALS: Record<string, number> = {
  XAUUSD: 2,
  EURUSD: 4,
  GBPUSD: 4,
  USDJPY: 3,
  BTCUSDT: 2,
  ETHUSDT: 2,
  SOLUSDT: 2,
  BNBUSDT: 2,
  XRPUSDT: 4,
};

// Never a thousands separator.
export function formatTradePrice(value: number, symbol?: string): string {
  const fixed = symbol != null ? PRICE_DECIMALS[symbol] : undefined;
  return value.toLocaleString("en-US", {
    useGrouping: false,
    minimumFractionDigits: fixed ?? 0,
    maximumFractionDigits: fixed ?? 4,
  });
}

// Lot size without trailing zeros: 0.1, 0.13, 1.46.
export function formatTradeLots(value: number): string {
  return String(Number(value.toFixed(3)));
}

// UTC getters so the server render and the browser agree in any timezone.
export function formatTradeDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}.${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}
