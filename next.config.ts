import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Preview-card routes read the bundled Geist fonts from disk at runtime.
  outputFileTracingIncludes: {
    "/api/og": ["./assets/*.ttf"],
    "/opengraph-image": ["./assets/*.ttf"],
    "/twitter-image": ["./assets/*.ttf"],
  },
};

export default nextConfig;
