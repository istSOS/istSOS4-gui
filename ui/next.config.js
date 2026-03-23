/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  env: {
    AUTHORIZATION: process.env.AUTHORIZATION ?? '1',
    NETWORK: process.env.NETWORK ?? '1',
  },
  basePath:
    process.env.NODE_ENV === 'development'
      ? process.env.NEXT_PUBLIC_BASE_PATH
      : '/NEXT_APP_URL',
}

module.exports = nextConfig
