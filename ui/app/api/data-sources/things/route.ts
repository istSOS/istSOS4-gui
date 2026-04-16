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
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import {
  getPrimaryDataSource,
  readDataSourcesConfigFile,
} from '@/server/data-sources/config'

type RequestPayload = {
  tokens?: Record<string, string>
}

const normalizeApiRoot = (value: string) => value.trim().replace(/\/+$/, '')

const expandClause = `
  Datastreams(
    $expand=Network,
            Sensor,
            Observations($top=1;$orderby=phenomenonTime desc),
            ObservedProperty
  ),
  Locations
`
  .replace(/\s+/g, ' ')
  .replace(/\s*([(),;=])\s*/g, '$1')
  .trim()

const buildThingsUrl = (apiRoot: string) => `${apiRoot}/Things?$expand=${expandClause}`

const withAuthHeaders = (token?: string | null) => {
  if (!token) return {}
  return { Authorization: `Bearer ${token}` }
}

type SourceResult = {
  id: string
  name: string
  endpoint: string
  things: any[]
  error: string | null
}

async function fetchThingsForSource(
  source: { id: string; name: string; apiRoot: string },
  token: string | null
): Promise<SourceResult> {
  const endpoint = normalizeApiRoot(source.apiRoot)

  try {
    const response = await fetch(buildThingsUrl(endpoint), {
      method: 'GET',
      headers: withAuthHeaders(token),
      cache: 'no-store',
    })

    if (!response.ok) {
      return {
        id: source.id,
        name: source.name,
        endpoint,
        things: [],
        error: `${response.status} ${response.statusText}`,
      }
    }

    const data = await response.json().catch(() => null)
    const values = Array.isArray(data?.value) ? data.value : []

    const things = values.map((thing: any) => ({
      ...thing,
      __sourceId: source.id,
      __sourceName: source.name,
      __sourceEndpoint: endpoint,
      Datastreams: Array.isArray(thing?.Datastreams)
        ? thing.Datastreams.map((datastream: any) => ({
            ...datastream,
            __sourceId: source.id,
            __sourceName: source.name,
            __sourceEndpoint: endpoint,
          }))
        : thing?.Datastreams,
    }))

    return {
      id: source.id,
      name: source.name,
      endpoint,
      things,
      error: null,
    }
  } catch (error) {
    return {
      id: source.id,
      name: source.name,
      endpoint,
      things: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function POST(request: Request) {
  const dataSourcesConfig = await readDataSourcesConfigFile()
  const primaryDataSource = getPrimaryDataSource(dataSourcesConfig)

  const body = (await request.json().catch(() => null)) as RequestPayload | null
  const tokenMap = body?.tokens && typeof body.tokens === 'object' ? body.tokens : {}

  const normalizedTokens = Object.entries(tokenMap).reduce<Record<string, string>>(
    (acc, [endpoint, token]) => {
      const normalizedEndpoint = normalizeApiRoot(endpoint)
      const normalizedToken = typeof token === 'string' ? token.trim() : ''
      if (!normalizedEndpoint || !normalizedToken) return acc
      acc[normalizedEndpoint] = normalizedToken
      return acc
    },
    {}
  )

  const cookieStore = await cookies()
  const cookieToken = cookieStore.get('token')?.value ?? null
  const primaryEndpoint = normalizeApiRoot(primaryDataSource.apiRoot)
  if (cookieToken && !normalizedTokens[primaryEndpoint]) {
    normalizedTokens[primaryEndpoint] = cookieToken
  }

  const sourceResults = await Promise.all(
    dataSourcesConfig.map((source) =>
      fetchThingsForSource(
        source,
        normalizedTokens[normalizeApiRoot(source.apiRoot)] ?? null
      )
    )
  )

  const things = sourceResults.flatMap((result) => result.things)

  return NextResponse.json(
    {
      ok: true,
      things,
      sources: sourceResults.map((result) => ({
        id: result.id,
        name: result.name,
        endpoint: result.endpoint,
        count: result.things.length,
        error: result.error,
      })),
    },
    { status: 200 }
  )
}
