import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    root: process.cwd(),
  },
  async redirects() {
    return [
      {
        source: "/shop/:slug/book",
        destination: "/book",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
