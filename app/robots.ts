import type { MetadataRoute } from "next";

// Everything but the public login/register pages holds a client's private
// ledger data once authenticated — those sections carry their own noindex
// metadata too, but keeping them out of robots.txt as well means a
// misconfigured crawler never even requests them.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/admin", "/pending", "/verify-email", "/api"],
    },
    sitemap: "https://xwallet.asia/sitemap.xml",
  };
}
