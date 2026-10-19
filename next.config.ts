import type { NextConfig } from "next";

// Catalog photos are served from the R2 bucket's public domain.
const r2 = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');

const nextConfig: NextConfig = {
  images: {
    remotePatterns: r2 ? [new URL(`${r2}/catalog/**`)] : [],
  },
};

export default nextConfig;
