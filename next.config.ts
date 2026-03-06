import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Removed static export to support API routes (Broadcast, Email, OTP) on Vercel

  // GitHub Pages doesn’t support Next.js image optimization
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_BUILD_ID: String(Date.now()),
  },
};

export default nextConfig;
