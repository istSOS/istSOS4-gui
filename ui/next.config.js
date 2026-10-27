/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  devIndicators: { position: 'top-left' },
  logging: {
    serverFunctions: false,
  },
  basePath:
    process.env.NODE_ENV === 'development'
      ? process.env.NEXT_PUBLIC_BASE_PATH
      : '/NEXT_APP_URL',
}

module.exports = nextConfig
