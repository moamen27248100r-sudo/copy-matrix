// Self-drawn monogram badge per blockchain network -- same rationale as
// CryptoIcon: an instantly-recognizable colored icon without pulling in
// real trademarked logo assets.
const NETWORK_STYLE: { match: RegExp; glyph: string; color: string }[] = [
  { match: /tron/i, glyph: "T", color: "#FF060A" },
  { match: /bnb|bsc|smart chain/i, glyph: "B", color: "#F0B90B" },
  { match: /ethereum|erc20/i, glyph: "Ξ", color: "#627EEA" },
  { match: /solana/i, glyph: "S", color: "#9945FF" },
  { match: /bitcoin/i, glyph: "₿", color: "#F7931A" },
];

function styleForNetwork(network: string) {
  return NETWORK_STYLE.find((s) => s.match.test(network)) ?? { glyph: network.charAt(0), color: "#64748B" };
}

export function NetworkIcon({ network, size = 32 }: { network: string; size?: number }) {
  const { glyph, color } = styleForNetwork(network);
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white shadow-inner"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.5 }}
      aria-hidden="true"
    >
      {glyph}
    </span>
  );
}
