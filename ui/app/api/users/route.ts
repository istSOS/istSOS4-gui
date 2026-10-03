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
  resolveAuthHeaders,
  resolveConfiguredEndpoint,
} from '@/server/upstream'
import { fetchUser } from '@/server/users/read'

type RequestPayload = {
  endpoint?: string
  token?: string
  /** Numeric user id, as parsed from a commit's `author` URI. */
  id?: string | number
}

/**
 * One user, read server-side for the same reason as the history routes: the API
 * is unreachable from the browser and sends no CORS headers.
 *
 * Answers `{ ok: true, user }`, or `{ ok: false, reason }` where the reason
 * says why there is nothing to show — see fetchUser for how each deployment
 * (with or without authorization, older API or newer) is told apart.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as RequestPayload | null

  const id = String(body?.id ?? '').trim()
  if (!/^\d+$/.test(id)) {
    return NextResponse.json(
      { ok: false, reason: 'error', error: 'A numeric id is required' },
      { status: 400 },
    )
  }

  const endpoint = await resolveConfiguredEndpoint(body?.endpoint)
  if (!endpoint) {
    return NextResponse.json(
      { ok: false, reason: 'error', error: 'Unknown data source endpoint' },
      { status: 400 },
    )
  }

  try {
    const headers = await resolveAuthHeaders(body?.token)
    return NextResponse.json(await fetchUser(endpoint, id, headers))
  } catch (error: unknown) {
    return NextResponse.json({
      ok: false,
      reason: 'error',
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
