// Shared browser-facing paths, including the standalone-image runtime placeholder.
const runtimeBasePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim()
export const basePath =
  runtimeBasePath && runtimeBasePath.length ? runtimeBasePath : '/NEXT_APP_URL'
export const normalizedBasePath =
  basePath === '/' ? '' : basePath.replace(/\/+$/, '')
