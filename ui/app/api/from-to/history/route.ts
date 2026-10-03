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

import { NextResponse } from 'next/server'

import { type HistoryWindow } from '@/features/from-to/lib/historyWindow'
import {
  resolveAuthHeaders,
  resolveConfiguredEndpoint,
} from '@/server/as-of/read'
import {
  fetchEntityHistory,
  fetchVersionCount,
} from '@/server/from-to/read'

type RequestPayload = {
  endpoint?: string
  token?: string
  /** Resource path, e.g. `Things(1)` or `Datastreams(3)`. */
  path?: string
  from?: string
  to?: string
  /** Paths to badge with a version count, for the entity rail. */
  countPaths?: string[]
}

/**
 * One entity's version history, read server-side because the API is unreachable
 * from the browser and sends no CORS headers.
 *
 * Answers the whole page from a single upstream request: every version in the
 * window, each with its own commit and full body, so the timeline, the version
 * list and every diff render without further round trips.
 *
 * `countPaths` is optional and additive — when present, each is counted for the
 * entity rail's badges. Counts are read through whatever path is given, since
 * `$count` is correct even where the rows duplicate.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as RequestPayload | null

  const path = String(body?.path ?? '').trim()
  if (!path) {
    return NextResponse.json(
      { ok: false, error: 'path is required' },
      { status: 400 },
    )
  }

  const window: HistoryWindow = {
    from: String(body?.from ?? '').trim(),
    to: String(body?.to ?? '').trim(),
  }

  const endpoint = await resolveConfiguredEndpoint(body?.endpoint)
  if (!endpoint) {
    return NextResponse.json(
      { ok: false, error: 'Unknown data source endpoint' },
      { status: 400 },
    )
  }

  try {
    const headers = await resolveAuthHeaders(body?.token)
    const result = await fetchEntityHistory(endpoint, path, window, headers)

    if (result.kind === 'error') {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: result.status === 500 ? 502 : result.status },
      )
    }

    const requestedCounts = Array.isArray(body?.countPaths)
      ? body.countPaths.filter((p): p is string => typeof p === 'string' && !!p.trim())
      : []

    // One count per rail entry, in parallel. A count that cannot be read comes
    // back null so its badge can stay blank rather than show a wrong number.
    const counts: Record<string, number | null> = {}
    if (requestedCounts.length > 0) {
      const settled = await Promise.all(
        requestedCounts.map((countPath) =>
          fetchVersionCount(endpoint, countPath, window, headers),
        ),
      )
      requestedCounts.forEach((countPath, index) => {
        counts[countPath] = settled[index]
      })
    }

    return NextResponse.json({
      ok: true,
      versions: result.versions,
      path: result.path,
      entitySet: result.entitySet,
      entityId: result.entityId,
      hasMore: result.hasMore,
      total: result.total,
      counts,
    })
  } catch (error: unknown) {
    return NextResponse.json(
      {
        ok: false,
        versions: [],
        counts: {},
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
