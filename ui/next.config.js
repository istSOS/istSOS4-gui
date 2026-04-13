/** @type {import('next').NextConfig} */
const normalizeBasePath = (value) => {
  if (!value) return undefined
  if (value === 'undefined' || value === 'null') return undefined

  const trimmed = value.trim()
  if (!trimmed || trimmed === '/' || trimmed === 'undefined' || trimmed === 'null') {
    return undefined
  }

  const noTrailingSlash = trimmed.replace(/\/+$/, '')
  return noTrailingSlash.startsWith('/') ? noTrailingSlash : `/${noTrailingSlash}`
}

const nextConfig = {
  output: 'standalone',
  env: {
    AUTHORIZATION: process.env.AUTHORIZATION ?? '1',
    NETWORK: process.env.NETWORK ?? '1',
  },
  basePath:
    process.env.NODE_ENV === 'development'
      ? normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH)
      : normalizeBasePath('/NEXT_APP_URL'),
}

module.exports = nextConfig
