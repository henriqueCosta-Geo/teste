const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
    webpackBuildWorker: true,
    // Disable Server Actions origin check for SAML callbacks and Railway
    serverActions: {
      allowedOrigins: [
        'geoassistantrailway-production.up.railway.app',
        'https://geoassistantrailway-production.up.railway.app',
        'login.microsoftonline.com',
        '*.microsoftonline.com',
      ],
      // Adiciona bodySizeLimit para evitar problemas com payloads grandes
      bodySizeLimit: '2mb',
    },
  },
  // Configurações para produção na Railway
  assetPrefix: process.env.NODE_ENV === 'production' ? undefined : undefined,
  // Trust Railway proxy headers
  headers: async () => {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
        ],
      },
    ]
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