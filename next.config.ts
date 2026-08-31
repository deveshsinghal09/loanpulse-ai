import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Standalone output is for the self-hosted Docker image. Vercel provides a
  // verified Next.js adapter and needs the native traced output instead.
  output: process.env.VERCEL === "1" ? undefined : "standalone",
};

export default nextConfig;
