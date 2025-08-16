/** @type {import('next').NextConfig} */

module.exports = {
  output: 'standalone',
  basePath:
    process.env.NODE_ENV === 'development'
      ? process.env.NEXT_PUBLIC_BASE_PATH
      : '/NEXT_APP_URL',
}
 