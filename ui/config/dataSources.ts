import rawDataSources from '@/config/data-sources.json'
import type { ConfiguredDataSource } from '@/types'

const PRIMARY_DATA_SOURCE_ID = '0'

const FALLBACK_SOURCE: ConfiguredDataSource = {
  id: 'default',
  name: 'Primary SensorThings',
  apiRoot: 'http://api:5000/istsos4/v1.1',
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
    apiRoot: String(source.apiRoot).trim().replace(/\/+$/, ''),
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
