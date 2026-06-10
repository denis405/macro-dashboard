import type { NextConfig } from "next";

const basePath =
  process.env.GITHUB_PAGES === "true" ? "/macro-dashboard" : "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  basePath,
  assetPrefix: basePath ? `${basePath}/` : undefined,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
