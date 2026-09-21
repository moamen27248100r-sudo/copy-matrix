// Library of 300 mock avatar URLs for leaders. Plain .mjs so both the app
// (via leader-avatar-library.d.mts) and scripts/assign-leader-avatars.mjs can
// import the same list.
export const ALL_300_LEADER_AVATARS = [
  // 1. Trader portraits
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80",
  ...Array.from({ length: 50 }, (_, i) => `https://i.pravatar.cc/150?img=${i + 1}`),

  // 2. Trading charts
  ...Array.from({ length: 60 }, (_, i) => `https://picsum.photos/seed/tradingchart${i + 100}/150/150`),

  // 3. Forex & stock logos
  ...Array.from({ length: 60 }, (_, i) => `https://picsum.photos/seed/forexlogo${i + 200}/150/150`),

  // 4. Crypto & market symbols
  ...Array.from({ length: 60 }, (_, i) => `https://picsum.photos/seed/marketsymbol${i + 300}/150/150`),

  // 5. Trading teams
  ...Array.from({ length: 60 }, (_, i) => `https://picsum.photos/seed/tradingteam${i + 400}/150/150`),
];
