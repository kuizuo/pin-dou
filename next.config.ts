import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  experimental: {
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;
