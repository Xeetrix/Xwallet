/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Asset logo URLs are admin-supplied (see components/AssetManagement.tsx)
    // and can point to any HTTPS host, so there's no fixed domain to allowlist.
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

module.exports = nextConfig;
