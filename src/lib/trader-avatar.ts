// Procedurally generated, synthetic avatars (DiceBear — free, open-source,
// nobody real) keyed by provider id, so each trader gets a stable image
// without using any real person's photo. Loaded via a plain <img> tag the
// same way SignupForm already loads flagcdn.com country flags — no
// next.config.ts images.remotePatterns entry needed.
export function traderAvatarUrl(providerId: string): string {
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(providerId)}`;
}
