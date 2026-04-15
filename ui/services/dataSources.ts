'use server'

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
import type { UiDataSource } from '@/types'

import { dataSourcesConfig, isPrimaryDataSource } from '@/config/dataSources'

type SourceToProbe = {
  id: string
  name: string
  apiRoot: string
  authorizationEnabled: boolean
  isPrimary: boolean
  probeUrl: string
}

const appendTopParam = (url: string) =>
  `${url}${url.includes('?') ? '&' : '?'}$top=1`

const normalizeError = (value: unknown) => {
  if (!value) return 'Unknown error'
  if (value instanceof Error) return value.message
  return String(value)
}

export async function getDataSources(
  token?: string | null
): Promise<UiDataSource[]> {
  const sources: SourceToProbe[] = dataSourcesConfig.map((source) => ({
    id: source.id,
    name: source.name,
    apiRoot: source.apiRoot,
    authorizationEnabled: source.authorizationEnabled,
    isPrimary: isPrimaryDataSource(source.id),
    probeUrl: appendTopParam(`${source.apiRoot}/Things`),
  }))

  const checks = await Promise.all(
    sources.map(async (source): Promise<UiDataSource> => {
      const accessMode =
        source.isPrimary && source.authorizationEnabled
          ? 'read_write'
          : 'anonymous'

      try {
        const response = await fetch(source.probeUrl, {
          method: 'GET',
          headers:
            source.isPrimary && source.authorizationEnabled && token
              ? { Authorization: `Bearer ${token}` }
              : {},
          cache: 'no-store',
        })

        const isReachable =
          response.ok || response.status === 401 || response.status === 403

        if (!isReachable) {
          return {
            id: source.id,
            name: source.name,
            endpoint: source.apiRoot,
            status: 'offline',
            accessMode,
            error: `${response.status} ${response.statusText}`,
          }
        }

        return {
          id: source.id,
          name: source.name,
          endpoint: source.apiRoot,
          status: 'online',
          accessMode,
          error:
            response.status === 401 || response.status === 403
              ? 'Authentication required'
              : null,
        }
      } catch (error) {
        return {
          id: source.id,
          name: source.name,
          endpoint: source.apiRoot,
          status: 'offline',
          accessMode,
          error: normalizeError(error),
        }
      }
    })
  )

  return checks
}
