/** @type {import('next').NextConfig} */
const path = require('path')

const nextConfig = {
  // Configuração mínima para Railway
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
  },

  // Webpack simples e direto
  webpack: (config) => {
    // Resolver paths @/ explicitamente
    config.resolve.alias['@'] = path.resolve(__dirname, 'src')

    // Fallbacks necessários
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    }

    return config
  },
}

module.exports = nextConfig