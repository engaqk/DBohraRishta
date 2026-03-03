import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Needed for GitHub Pages deployment under a subpath
  output: "export",
  basePath: "/DBohraRishta",   // match your repo name exactly (case-sensitive)
  assetPrefix: "/DBohraRishta/",

  // GitHub Pages doesn’t support Next.js image optimization
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
