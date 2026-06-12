import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  experimental: {
    turbopackFileSystemCacheForDev: false,
  },
};

export default nextConfig;
