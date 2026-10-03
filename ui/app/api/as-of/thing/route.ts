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

import {
  fetchThingAsOf,
  resolveAuthHeaders,
  resolveConfiguredEndpoint,
} from '@/server/as-of/read'

type RequestPayload = {
  endpoint?: string
  thingId?: string | number
  asOfDate?: string
  token?: string
}

/**
 * Resolves a Thing at a point in transaction time (`$as_of`).
 *
 * Same-origin by design: the browser cannot resolve the API's Docker network
 * name and the API sends no CORS headers, so this hop is what makes snapshot
 * data reachable from the client at all.
 *
 * Always answers 200 with a body describing the outcome — a snapshot miss (the
 * Thing did not exist yet) is a normal result, not a transport failure, and the
 * client has to tell the two apart.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as RequestPayload | null
  const thingId = String(body?.thingId ?? '').trim()
  const asOfDate = String(body?.asOfDate ?? '').trim()

  if (!thingId || !asOfDate) {
    return NextResponse.json(
      { ok: false, error: 'thingId and asOfDate are required' },
      { status: 400 }
    )
  }

  const endpoint = await resolveConfiguredEndpoint(body?.endpoint)
  if (!endpoint) {
    return NextResponse.json(
      { ok: false, error: 'Unknown data source endpoint' },
      { status: 400 }
    )
  }

  try {
    const headers = await resolveAuthHeaders(body?.token)
    const result = await fetchThingAsOf(endpoint, thingId, asOfDate, headers)

    if (result.kind === 'thing') {
      return NextResponse.json({ ok: true, status: 200, thing: result.thing })
    }
    if (result.kind === 'missing') {
      return NextResponse.json({
        ok: true,
        status: 404,
        thing: null,
        versions: result.versions,
      })
    }

    return NextResponse.json({
      ok: false,
      status: result.status,
      error: result.error,
    })
  } catch (error: unknown) {
    return NextResponse.json({
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
