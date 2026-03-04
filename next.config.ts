import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Removed basePath and assetPrefix for custom domain deployment (www.53dbohrarishta.in)
  // These are only needed if deploying to username.github.io/repo-name/
  output: "export",

  // GitHub Pages doesn’t support Next.js image optimization
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
