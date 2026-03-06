import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Removed static export to support API routes (Broadcast, Email, OTP) on Vercel

  // GitHub Pages doesn’t support Next.js image optimization
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
