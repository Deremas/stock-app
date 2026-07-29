import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,

  typescript: {
    ignoreBuildErrors: false,
  },

  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
