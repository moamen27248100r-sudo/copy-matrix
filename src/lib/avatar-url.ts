// The avatar route is cached for a year, so the URL carries a version: bump
// it whenever the artwork in avatar-svg.ts changes so browsers and the CDN
// fetch the new set. (Separate file so client components don't bundle the
// SVG generator.)
export const AVATAR_VERSION = 4;
// The picture of a leader without an uploaded photo is a round badge with their initials (k=i), never
// a drawing of a chart: a chart in the avatar reads as a figure.
export const defaultAvatarUrl = (providerId: string) => `/api/avatar/${providerId}?k=i&v=${AVATAR_VERSION}`;

/** The picture to show: an uploaded photo as it is; the old generated chart drawings give way to the initials badge. */
export const avatarSrc = (providerId: string, stored?: string | null) =>
  stored && !stored.startsWith("/api/avatar/") ? stored : defaultAvatarUrl(providerId);
