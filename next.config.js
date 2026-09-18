/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Only the crypto icon CDN is ever loaded as a remote image now that
    // asset logos are resolved automatically from ticker symbols instead
    // of admin-entered URLs (see components/CryptoIcon.tsx).
    remotePatterns: [
      { protocol: "https", hostname: "cdn.jsdelivr.net", pathname: "/npm/cryptocurrency-icons@0.18.1/**" },
    ],
  },
};

module.exports = nextConfig;
