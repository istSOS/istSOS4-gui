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
import { fetchChangeCount } from '@/server/from-to/read'

type RequestPayload = {
  endpoint?: string
  token?: string
  /** Parent entity, e.g. `Datastreams(7)`. */
  path?: string
  /** The related collection to count, e.g. `Observations`. */
  set?: string
  from?: string
  to?: string
}

/**
 * How many times a relation too large to list changed inside the window — the
 * figure the entity rail shows instead of listing thousands of Observations.
 *
 * Its own request, apart from the rail's: on a very large relation the two
 * counts behind it are the slowest reads the rail makes, and the rest of the
 * rail must not wait for them. Answers `changes: null` whenever the count
 * cannot be given exactly; the rail then keeps its plain "too many" line.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as RequestPayload | null

  const path = String(body?.path ?? '').trim()
  const set = String(body?.set ?? '').trim()
  if (!path || !set) {
    return NextResponse.json(
      { ok: false, error: 'path and set are required' },
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
    const changes = await fetchChangeCount(endpoint, path, set, window, headers)
    return NextResponse.json({ ok: true, changes })
  } catch (error: unknown) {
    return NextResponse.json({
      ok: false,
      changes: null,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
