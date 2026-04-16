// Copyright 2026 SUPSI
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
import { access, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { ConfiguredDataSource } from '@/types'

const PRIMARY_DATA_SOURCE_ID = '0'

const FALLBACK_SOURCE: ConfiguredDataSource = {
  id: '0',
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

const CONFIG_PATH_CANDIDATES = [
  path.join(process.cwd(), 'ui', 'config', 'data-sources.json'),
  path.join(process.cwd(), 'config', 'data-sources.json'),
]

const resolveConfigFilePath = async () => {
  for (const candidate of CONFIG_PATH_CANDIDATES) {
    try {
      await access(candidate)
      return candidate
    } catch {
      continue
    }
  }

  return CONFIG_PATH_CANDIDATES[0]
}

const normalizeSources = (
  sources: Array<Partial<ConfiguredDataSource> | null | undefined>
) => {
  const normalized = sources
    .map((source, index) => normalizeSource(source, index))
    .filter((source): source is ConfiguredDataSource => !!source)

  return normalized.length > 0 ? normalized : [FALLBACK_SOURCE]
}

export const getPrimaryDataSource = (sources: ConfiguredDataSource[]) => {
  return (
    sources.find((source) => source.id === PRIMARY_DATA_SOURCE_ID) ?? sources[0]
  )
}

export async function readDataSourcesConfigFile(): Promise<ConfiguredDataSource[]> {
  const filePath = await resolveConfigFilePath()

  const raw = await readFile(filePath, 'utf-8').catch(() => '')
  if (!raw.trim()) return [FALLBACK_SOURCE]

  try {
    const parsed = JSON.parse(raw) as { sources?: unknown } | null
    const candidateSources = Array.isArray(parsed?.sources) ? parsed.sources : []

    return normalizeSources(
      candidateSources as Array<Partial<ConfiguredDataSource> | null | undefined>
    )
  } catch {
    return [FALLBACK_SOURCE]
  }
}

export async function writeDataSourcesConfigFile(
  sources: Array<Partial<ConfiguredDataSource> | null | undefined>
): Promise<ConfiguredDataSource[]> {
  const normalizedSources = normalizeSources(sources)
  const filePath = await resolveConfigFilePath()
  const payload = JSON.stringify({ sources: normalizedSources }, null, 2)

  await writeFile(filePath, `${payload}\n`, 'utf-8')

  return normalizedSources
}
