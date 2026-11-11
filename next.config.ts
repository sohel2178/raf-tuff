import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Lets a second dev/preview instance run without clobbering the main .next folder
  distDir: process.env.NEXT_DIST_DIR || '.next',
  poweredByHeader: false,
  // The floating dev badge covers the bottom tab bar and "Log out"
  devIndicators: false,
};

export default nextConfig;
