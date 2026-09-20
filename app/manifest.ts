import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "XWallet Asia",
    short_name: "XWallet",
    description: "Private wealth and digital asset custody.",
    start_url: "/login",
    display: "standalone",
    background_color: "#090A10",
    theme_color: "#090A10",
    icons: [
      { src: "/pwa/icon-192", sizes: "192x192", type: "image/png" },
      { src: "/pwa/icon-512", sizes: "512x512", type: "image/png" },
    ],
  };
}
