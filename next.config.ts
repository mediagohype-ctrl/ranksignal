import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets a verification build run alongside `next dev` without sharing .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
