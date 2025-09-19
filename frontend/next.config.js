const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
    webpackBuildWorker: true,
  },
  webpack: (config, { buildId, dev, isServer, defaultLoaders, nextRuntime, webpack }) => {
    // Force path mapping to work in Railway
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, 'src'),
    }

    // Ignore problematic edge runtime warnings
    if (!dev) {
      config.ignoreWarnings = [
        /Module not found.*url/,
        /node_modules.*url/,
      ]
    }

    return config
  },
}

module.exports = nextConfig