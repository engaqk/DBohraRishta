import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/dbohrarishta", // Needed for GitHub Pages
  images: {
    unoptimized: true
  }
};

export default nextConfig;
