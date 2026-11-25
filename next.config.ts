import type { NextConfig } from "next";

// Catalog photos are served from the R2 bucket's public domain; stock photos from Unsplash.
const r2 = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      ...(r2 ? [new URL(`${r2}/catalog/**`)] : []),
      // Storefront stock photos (features/catalog/store.ts). The exact query is
      // pinned so the optimizer can't be used to fetch arbitrary Unsplash sizes.
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**', search: '?w=3200&q=80' },
    ],
  },
};

export default nextConfig;
