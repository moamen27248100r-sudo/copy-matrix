// The avatar route is cached for a year, so the URL carries a version: bump
// it whenever the artwork in avatar-svg.ts changes so browsers and the CDN
// fetch the new set. (Separate file so client components don't bundle the
// SVG generator.)
export const AVATAR_VERSION = 4;
export const defaultAvatarUrl = (providerId: string) => `/api/avatar/${providerId}?v=${AVATAR_VERSION}`;
