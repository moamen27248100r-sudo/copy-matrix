// Leader pictures (Unsplash direct URLs): AI / abstract-tech images, two trading
// chart photos and three portrait photos.
// AI / abstract-tech images (Unsplash direct URLs) used as leader pictures.
// Each URL is handed to at most ONE leader (see scripts/assign-leader-avatars.mjs).
//
// Kept out of the supplied list after checking every image:
//   - photo-1614680376593 ......... 404 (does not exist)
//   - photo-1633167606207 ......... DNA helix, unrelated to trading
//   - photo-1519085360753 ......... identifiable man's portrait
//   - photo-1551836022 ............ two women at a desk, faces visible
//   - picsum.photos "aifx" seeds .. random stock scenery, not charts/tech
export const AI_TECH_AVATARS = [
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1618005198919-d3d4b5a92ead?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=200&auto=format&fit=crop&q=80",
  // Trading chart photos.
  "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=200&auto=format&fit=crop&q=80",
];

// Portrait photos of people (real stock-photo models). Handed out first, to the
// leaders featured on the home page.
export const PERSON_AVATARS = [
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=200&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80",
];
