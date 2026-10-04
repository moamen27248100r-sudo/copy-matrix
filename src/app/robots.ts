import type { MetadataRoute } from "next";
import { SEARCH_INDEXING_ENABLED } from "@/lib/indexing";

export default function robots(): MetadataRoute.Robots {
  return SEARCH_INDEXING_ENABLED
    ? { rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] } }
    : { rules: { userAgent: "*", disallow: "/" } };
}
