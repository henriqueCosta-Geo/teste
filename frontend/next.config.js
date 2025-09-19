/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  },
  // Ensure API routes work properly
  async rewrites() {
    return []
  },
  // Configure Prisma and database
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Server-side webpack config for Prisma
      config.externals.push('@prisma/client')
    } else {
      // Client-side webpack config
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        url: false,
      }
    }
    return config
  },
  // Enable experimental features for better API route handling
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
  },
  // Remove problematic build config
  skipTrailingSlashRedirect: true,
}

module.exports = nextConfig