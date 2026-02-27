import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/dbohranisbat", // Needed for GitHub Pages
  images: {
    unoptimized: true
  }
};

export default nextConfig;
