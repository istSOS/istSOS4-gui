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

import { normalizeApiRoot } from '@/server/as-of/read'
import { clampAsOf, readThingsAsOf } from '@/server/as-of/snapshot'
import {
  getPrimaryDataSource,
  readDataSourcesConfigFile,
} from '@/server/data-sources/config'

type RequestPayload = {
  asOfDate?: string
  tokens?: Record<string, string>
}

/**
 * Every Thing of every configured data source as it existed at `asOfDate` —
 * the map's snapshot counterpart of `/api/data-sources/things`.
 *
 * It cannot be derived from the live list: a Thing deleted since is not in it
 * at all, and one created since must not be drawn. Sources are read
 * independently; one that fails is reported in `sources[].error` and its
 * Things are left out, so the client can fall back for that source alone.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as RequestPayload | null
  const asOfDate = String(body?.asOfDate ?? '').trim()

  if (!asOfDate || !clampAsOf(asOfDate)) {
    return NextResponse.json(
      { ok: false, error: 'A valid asOfDate is required' },
      { status: 400 }
    )
  }

  const dataSources = await readDataSourcesConfigFile()
  const primaryEndpoint = normalizeApiRoot(getPrimaryDataSource(dataSources).apiRoot)

  // Same token resolution as the live things route, so a source readable live
  // is readable in a snapshot.
  const tokens: Record<string, string> = {}
  const requested =
    body?.tokens && typeof body.tokens === 'object' ? body.tokens : {}
  for (const [endpoint, token] of Object.entries(requested)) {
    const key = normalizeApiRoot(endpoint)
    const value = typeof token === 'string' ? token.trim() : ''
    if (key && value) tokens[key] = value
  }
  const cookieToken = (await cookies()).get('token')?.value ?? ''
  if (cookieToken && !tokens[primaryEndpoint]) tokens[primaryEndpoint] = cookieToken

  const results = await Promise.all(
    dataSources.map(async (source) => {
      const endpoint = normalizeApiRoot(source.apiRoot)
      const token = tokens[endpoint]
      const headers: Record<string, string> = token
        ? { Authorization: `Bearer ${token}` }
        : {}
      const meta = {
        __sourceId: source.id,
        __sourceName: source.name,
        __sourceEndpoint: endpoint,
      }

      try {
        const snapshot = await readThingsAsOf(endpoint, asOfDate, headers)
        const things = (snapshot?.things ?? []).map((thing) => ({
          ...thing,
          ...meta,
          Datastreams: (Array.isArray(thing.Datastreams) ? thing.Datastreams : []).map(
            (datastream: Record<string, unknown>) => ({ ...datastream, ...meta })
          ),
        }))
        return {
          endpoint,
          things,
          error: null as string | null,
          readingsUnavailable: snapshot ? !snapshot.readingsAvailable : false,
        }
      } catch (error) {
        return {
          endpoint,
          things: [],
          error: error instanceof Error ? error.message : String(error),
          readingsUnavailable: false,
        }
      }
    })
  )

  return NextResponse.json({
    ok: true,
    asOf: clampAsOf(asOfDate),
    things: results.flatMap((result) => result.things),
    sources: results.map(({ endpoint, things, error, readingsUnavailable }) => ({
      endpoint,
      count: things.length,
      error,
      readingsUnavailable,
    })),
  })
}
