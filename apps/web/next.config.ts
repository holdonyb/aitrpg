import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const proxyTarget = process.env.API_PROXY_TARGET;
    if (!proxyTarget) {
      return [];
    }

    return [
      {
        source: "/api/:path*",
        destination: `${proxyTarget}/:path*`,
      },
    ];
  },
};

export default nextConfig;
