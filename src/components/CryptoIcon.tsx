// Self-contained monogram badge per currency -- avoids pulling in real
// trademarked logo assets from a third party while still giving each
// currency an instantly-recognizable colored icon in the picker/QR card.
const SYMBOL_GLYPH: Record<string, string> = {
  USDT: "₮",
  BTC: "₿",
  ETH: "Ξ",
  SOL: "◎",
  TRX: "T",
  USDC: "$",
  BNB: "B",
};

export function CryptoIcon({ symbol, color, size = 36 }: { symbol: string; color: string; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white shadow-inner"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.5 }}
      aria-hidden="true"
    >
      {SYMBOL_GLYPH[symbol] ?? symbol.charAt(0)}
    </span>
  );
}
