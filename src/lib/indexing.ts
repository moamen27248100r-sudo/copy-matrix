// Search-engine indexing is OFF until launch. Set ALLOW_SEARCH_INDEXING=true (Vercel environment
// variable, then redeploy) to let search engines index the site. Applied three ways: the
// X-Robots-Tag header (next.config.ts), the robots meta tag (root layout) and robots.txt.
export const SEARCH_INDEXING_ENABLED = process.env.ALLOW_SEARCH_INDEXING === "true";
