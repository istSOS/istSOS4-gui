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
import { fetchRelatedEntities } from '@/server/from-to/read'

type RequestPayload = {
  endpoint?: string
  token?: string
  /** Parent entity, e.g. `Things(1)`. */
  path?: string
  from?: string
  to?: string
}

/**
 * The entities related to one entity, each with its version count — the entity
 * rail's data.
 *
 * Separate from the history route because it is slower and less important: the
 * page renders its timeline and diff from the history response alone, and this
 * fills the rail in when it arrives. It costs one read per relation plus one
 * count per related entity, since the API offers no way to count a parent's
 * children in a single request.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as RequestPayload | null

  const path = String(body?.path ?? '').trim()
  if (!path) {
    return NextResponse.json({ ok: false, error: 'path is required' }, { status: 400 })
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
    const groups = await fetchRelatedEntities(endpoint, path, window, headers)
    return NextResponse.json({ ok: true, groups })
  } catch (error: unknown) {
    // The rail is an enhancement; a failure here must not take the page down.
    return NextResponse.json({
      ok: false,
      groups: [],
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
