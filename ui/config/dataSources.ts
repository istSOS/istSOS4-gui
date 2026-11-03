import type { ConfiguredDataSource } from '@/types'

import rawDataSources from '@/config/data-sources.json'

const PRIMARY_DATA_SOURCE_ID = '0'
const ISTSOS4_URL_PLACEHOLDER = '/ISTSOS4_URL'

const normalizeApiRoot = (value: string) => value.trim().replace(/\/+$/, '')

const getConfiguredApiRoot = () => {
  const apiRoot = process.env.NEXT_PUBLIC_ISTSOS4_URL

  if (!apiRoot?.trim()) {
    throw new Error('Missing NEXT_PUBLIC_ISTSOS4_URL environment variable')
  }

  return normalizeApiRoot(apiRoot)
}

const resolveApiRoot = (value: string) => {
  const normalizedValue = normalizeApiRoot(value)

  return normalizedValue === ISTSOS4_URL_PLACEHOLDER
    ? getConfiguredApiRoot()
    : normalizedValue
}

const FALLBACK_SOURCE: ConfiguredDataSource = {
  id: 'default',
  name: 'Primary SensorThings',
  apiRoot: resolveApiRoot(ISTSOS4_URL_PLACEHOLDER),
  authorizationEnabled: true,
  networkEnabled: true,
}

const normalizeSource = (
  source: Partial<ConfiguredDataSource> | null | undefined,
  index: number
): ConfiguredDataSource | null => {
  if (!source?.apiRoot || !String(source.apiRoot).trim()) return null

  const safeId = String(source.id ?? `source-${index + 1}`).trim()
  const safeName = String(source.name ?? `Data source ${index + 1}`).trim()

  return {
    id: safeId || `source-${index + 1}`,
    name: safeName || `Data source ${index + 1}`,
    apiRoot: resolveApiRoot(String(source.apiRoot)),
    authorizationEnabled: source.authorizationEnabled !== false,
    networkEnabled: source.networkEnabled !== false,
  }
}

declare global {
  // Registered by instrumentation.ts on the server: reads the file as it is now.
  var readDataSourcesFile: (() => unknown) | undefined
}

/**
 * The primary source. On the server it is read from the file on each call,
 * because the data sources page edits that file while the app runs; the
 * browser uses the bundled copy.
 */
export function getPrimaryDataSource(): ConfiguredDataSource | undefined {
  const raw = (
    globalThis.readDataSourcesFile
      ? globalThis.readDataSourcesFile()
      : rawDataSources
  ) as {
    sources?: Array<Partial<ConfiguredDataSource> | null>
  } | null
  // An explicit empty list means no sources; the fallback only replaces a
  // malformed configuration.
  const sources = Array.isArray(raw?.sources)
    ? raw.sources
        .map((source, index) => normalizeSource(source, index))
        .filter((source): source is ConfiguredDataSource => !!source)
    : [FALLBACK_SOURCE]
  return (
    sources.find((source) => source.id === PRIMARY_DATA_SOURCE_ID) ?? sources[0]
  )
}
