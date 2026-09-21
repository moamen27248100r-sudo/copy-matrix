// Mock avatar library for leaders (trading / forex themed, no personal
// portraits). Plain .mjs so both the app (via leader-avatar-library.d.mts) and
// scripts/assign-leader-avatars.mjs can import the same list.
//
// Note: the "charts" group below uses computed Unsplash ids that do not
// resolve (404); the seeder verifies every URL and only assigns live ones.
// Photos of identifiable people were dropped from group 2 (1486406146926 is a
// building and 1507679799987 a faceless suit; the rest showed faces).
export const FX_ZULUTRADE_AVATARS = [
  // 1. Forex charts & trading UI
  ...Array.from({ length: 70 }, (_, i) => `https://images.unsplash.com/photo-${1611974789855 + i * 10}?w=200&auto=format&fit=crop&q=80`),

  // 2. Dark / conceptual traders
  "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=200&auto=format&fit=crop&q=80",
  ...Array.from({ length: 65 }, (_, i) => `https://picsum.photos/seed/darktrader${i + 10}/200/200`),

  // 3. FX, gold & crypto icons
  ...Array.from({ length: 80 }, (_, i) => `https://picsum.photos/seed/fxmarket${i + 100}/200/200`),

  // 4. Trading teams & badges
  ...Array.from({ length: 80 }, (_, i) => `https://picsum.photos/seed/fxteams${i + 200}/200/200`),
];

export const ALL_300_LEADER_AVATARS = FX_ZULUTRADE_AVATARS;
