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

const parsedSources = Array.isArray(rawDataSources?.sources)
  ? rawDataSources.sources
      .map((source, index) => normalizeSource(source, index))
      .filter((source): source is ConfiguredDataSource => !!source)
  : []

export const dataSourcesConfig: ConfiguredDataSource[] =
  parsedSources.length > 0 ? parsedSources : [FALLBACK_SOURCE]

export const primaryDataSource =
  dataSourcesConfig.find((source) => source.id === PRIMARY_DATA_SOURCE_ID) ??
  dataSourcesConfig[0]

export const isPrimaryDataSource = (id: string) => id === primaryDataSource.id
