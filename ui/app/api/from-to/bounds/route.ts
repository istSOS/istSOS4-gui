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
} from '@/server/as-of/read'
import { fetchEarliestVersion } from '@/server/from-to/read'

type RequestPayload = {
  endpoint?: string
  token?: string
  /** Entity whose lifetime is being asked about, e.g. `Things(1)`. */
  path?: string
}

/**
 * When an entity's history starts.
 *
 * Used by the history dialog to open on a window that actually contains
 * something. A fixed "last 30 days" is empty for any entity last edited before
 * that, and the user then has to widen the range by hand to discover there was
 * anything to see at all.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as RequestPayload | null

  const path = String(body?.path ?? '').trim()
  if (!path) {
    return NextResponse.json({ ok: false, error: 'path is required' }, { status: 400 })
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
    const earliest = await fetchEarliestVersion(endpoint, path, headers)
    return NextResponse.json({ ok: true, earliest })
  } catch {
    // The dialog has its own default; a failure here must not block opening it.
    return NextResponse.json({ ok: true, earliest: null })
  }
}
