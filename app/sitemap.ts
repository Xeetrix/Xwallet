import type { MetadataRoute } from "next";

const SITE_URL = "https://xwallet.asia";

// Only the two public, unauthenticated pages belong here — every other
// route either redirects based on session state or requires login, so
// there's nothing else for a crawler to usefully discover.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/login`, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/register`, changeFrequency: "monthly", priority: 0.8 },
  ];
}
