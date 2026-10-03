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
  fetchThingCommits,
  fetchThingLocationChanges,
  fetchThingVersions,
  resolveAuthHeaders,
  resolveConfiguredEndpoint,
} from '@/server/as-of/read'

type RequestPayload = {
  endpoint?: string
  thingId?: string | number
  token?: string
}

/**
 * A Thing's version history, read server-side for the same reason as the
 * snapshot route: the API is unreachable from the browser. Feeds the timeline
 * scrubber's tick marks, each with the commit message that explains it.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as RequestPayload | null
  const thingId = String(body?.thingId ?? '').trim()

  if (!thingId) {
    return NextResponse.json(
      { ok: false, error: 'thingId is required' },
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
    // One request: every version of the Thing, each with the commit that
    // produced it (see fetchThingVersions). `commits` is only read when that
    // comes back empty, so it costs a round trip only when there is no history
    // to show otherwise.
    const [versions, locationChanges] = await Promise.all([
      fetchThingVersions(endpoint, thingId, headers),
      // Relocations and Location edits leave the Thing's own versions alone,
      // yet they move its marker — the scrubber needs a tick for each.
      fetchThingLocationChanges(endpoint, thingId, headers),
    ])
    const commits = versions.length
      ? []
      : await fetchThingCommits(endpoint, thingId, headers)
    return NextResponse.json({ ok: true, commits, versions, locationChanges })
  } catch (error: unknown) {
    return NextResponse.json({
      ok: false,
      commits: [],
      versions: [],
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
