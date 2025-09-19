/** @type {import('next').NextConfig} */
const path = require('path')

const nextConfig = {
  // Desabilitar telemetria
  telemetry: {
    enabled: false
  },

  // Experimental features mínimas
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
  },

  // Webpack configuration
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Configurar alias @ para apontar para src
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.join(__dirname, 'src'),
      '@/lib': path.join(__dirname, 'src/lib'),
      '@/components': path.join(__dirname, 'src/components'),
      '@/app': path.join(__dirname, 'src/app'),
      '@/hooks': path.join(__dirname, 'src/hooks'),
    }

    // Fallbacks para módulos que não existem no browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        path: false,
        os: false,
      }
    }

    // Log para debug (remover depois)
    console.log('Webpack alias configurado:', config.resolve.alias)

    return config
  },
}

module.exports = nextConfig