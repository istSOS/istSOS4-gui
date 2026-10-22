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

/**
 * @file server/as-of/read.ts
 *
 * Server-side reads for the As-Of (time-travel) feature.
 *
 * These run inside the Next server, never in the browser. That is the whole
 * point: the API is reached over the Docker network name configured in
 * NEXT_PUBLIC_ISTSOS4_URL, which a browser cannot resolve, and the API sends no
 * CORS headers — so a direct client-side `$as_of` fetch always fails and the
 * snapshot silently degrades to live data. Route handlers call these instead.
 */

import { cookies } from 'next/headers'

import { parseValidity as readSystemTimeValidity } from '@/lib/systemTimeValidity'
import {
  readAll,
  readThingsAsOf,
  SnapshotReadError,
  type ThingsAsOf,
} from '@/server/as-of/snapshot'
import {
  getPrimaryDataSource,
  readDataSourcesConfigFile,
} from '@/server/data-sources/config'

/** Commit shape as returned by the backend (`date`, not `authoredAt`). */
export type BackendCommit = {
  '@iot.id': number | string
  message: string
  date: string
  actionType: string
}

export const normalizeApiRoot = (value: string) =>
  value.trim().replace(/\/+$/, '')

/**
 * Resolves a client-supplied endpoint against the configured data sources.
 *
 * Only endpoints this deployment is configured to talk to are accepted — the
 * route must never become an open proxy for arbitrary URLs. Returns null when
 * the endpoint is not one of ours.
 */
export async function resolveConfiguredEndpoint(
  requested?: string | null
): Promise<string | null> {
  const sources = await readDataSourcesConfigFile()
  const normalizedRequested = requested ? normalizeApiRoot(requested) : ''

  if (!normalizedRequested) {
    return normalizeApiRoot(getPrimaryDataSource(sources).apiRoot)
  }

  const match = sources.find(
    (source) => normalizeApiRoot(source.apiRoot) === normalizedRequested
  )
  return match ? normalizeApiRoot(match.apiRoot) : null
}

/** Bearer token for the request: the caller's, falling back to the cookie. */
export async function resolveAuthHeaders(
  token?: string | null
): Promise<Record<string, string>> {
  const explicit = typeof token === 'string' ? token.trim() : ''
  if (explicit) return { Authorization: `Bearer ${explicit}` }

  const cookieStore = await cookies()
  const cookieToken = cookieStore.get('token')?.value ?? ''
  return cookieToken ? { Authorization: `Bearer ${cookieToken}` } : {}
}

export type ThingAsOfResult =
  /** The Thing as it existed at that instant. */
  | { kind: 'thing'; thing: Record<string, unknown> }
  /** The Thing did not exist then; versions say whether it was before or after. */
  | { kind: 'missing'; versions: ThingVersion[] }
  | { kind: 'error'; status: number; error: string }

/**
 * A Thing as it existed at `asOfDate`, expanded for the datastream table.
 *
 * Built by the same `readThingsAsOf` as the map, so the panel and the marker
 * describe one snapshot: same Datastreams, same latest readings, same place.
 *
 * A 404 means the Thing did not exist at that point in transaction time; the
 * version history is returned with it so the caller can tell "not yet created"
 * from "deleted" without a second round trip.
 */
export async function fetchThingAsOf(
  endpoint: string,
  thingId: string,
  asOfDate: string,
  headers: Record<string, string>
): Promise<ThingAsOfResult> {
  let snapshot: ThingsAsOf | null
  try {
    snapshot = await readThingsAsOf(endpoint, asOfDate, headers, thingId)
  } catch (error) {
    return {
      kind: 'error',
      status: error instanceof SnapshotReadError ? error.status : 502,
      error: error instanceof Error ? error.message : String(error),
    }
  }

  if (!snapshot || !snapshot.things[0]) {
    const versions = await fetchThingVersions(endpoint, thingId, headers)
    return { kind: 'missing', versions }
  }

  return { kind: 'thing', thing: snapshot.things[0] }
}

/**
 * One version of a Thing in transaction time. `end` is null while current,
 * `commit` is the commit that produced this version (null on a backend that
 * cannot report it).
 */
export type ThingVersion = {
  start: string
  end: string | null
  commit: BackendCommit | null
}

/**
 * Transaction-time window wide enough to contain every version ever written.
 *
 * `$from_to` selects the versions whose validity *overlaps* the window, so any
 * window containing all of recorded history returns the complete chain. It is a
 * constant rather than "now" so the API can cache the response; unlike `$as_of`
 * (which rejects future instants) `$from_to` puts no ceiling on its bounds.
 */
const FULL_HISTORY_WINDOW = '1970-01-01T00:00:00Z/2099-01-01T00:00:00Z'

/**
 * Splits a `systemTimeValidity` range into its two ends, `infinity` -> null.
 *
 * Delegates to the shared reader, which the history UI uses too. Splitting on
 * `/` here directly used to mis-read the two shapes that carry no upper bound
 * in the usual place: a bare timestamp (a version in force for zero time, which
 * `visitors.py` formats without a `/`) came back as `end: null` and so showed a
 * superseded version as the current one.
 */
function parseValidity(
  validity: unknown
): { start: string; end: string | null } | null {
  const parsed = readSystemTimeValidity(validity)
  if (!parsed) return null
  return { start: parsed.start, end: parsed.end }
}

/**
 * A Thing's complete version history, each version carrying its own commit.
 *
 * `Things(id)/Commits` cannot be used for this: it navigates the *current*
 * `Thing` row, whose single `commit_id` an UPDATE overwrites — so an edited
 * Thing appears to have no history before its last edit, and a deleted one has
 * no row at all. (`Things(id)/Commits?$as_of=…` answers 500: `$as_of` appends
 * `TravelTime` to the main entity, and `Commit` is not a versioned table.)
 *
 * The history lives in the `Thing_traveltime` view instead, where every version
 * keeps the `commit_id` in effect for it. `$from_to` reads that view, returning
 * one row per version ordered oldest → newest, and `$expand=Commit` attaches
 * each version's own commit — so the whole timeline arrives in one query,
 * paged like any collection (a busy Thing outgrows the API's 100-row page).
 *
 * `$expand` must be the SINGULAR `Commit`: the plural is rejected, as is any
 * other expand, and both come back as a 500 rather than a 4xx.
 *
 * Returns oldest → newest, empty when the history cannot be read.
 */
export async function fetchThingVersions(
  endpoint: string,
  thingId: string,
  headers: Record<string, string>
): Promise<ThingVersion[]> {
  const url =
    `${endpoint}/Things(${encodeURIComponent(thingId)})` +
    `?$from_to=${encodeURIComponent(FULL_HISTORY_WINDOW)}` +
    `&$expand=Commit` +
    `&$select=systemTimeValidity`

  let rows: unknown[] = []
  try {
    // Every page: a busy Thing has more versions than one page holds, and a
    // first page ending on a closed version would read as a deletion.
    rows = await readAll(url, headers)
  } catch {
    // A backend without versioning enabled has no systemTimeValidity column and
    // rejects $from_to outright; fall back to reading versions one at a time.
    return walkThingVersions(endpoint, thingId, headers)
  }

  const versions: ThingVersion[] = []
  for (const row of rows) {
    const record = row as Record<string, unknown>
    const range = parseValidity(record?.systemTimeValidity)
    if (!range) continue
    const commit = record?.Commit as BackendCommit | undefined
    versions.push({
      ...range,
      commit: commit && commit['@iot.id'] != null ? commit : null,
    })
  }

  // Ordering is the API's (id, systemTimeValidity ASC), but the scrubber depends
  // on it, so do not take it on trust.
  return versions.sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
}

/** One change to where a Thing stands, at the instant it was committed. */
export type LocationChange = {
  at: string
  commit: BackendCommit | null
}

/**
 * Every change to where a Thing stands: each relocation (a HistoricalLocation)
 * and each edit of a Location it has stood at (a Location version).
 *
 * The Thing's own versions miss both. `PATCH Things(id)` with only `Locations`
 * never touches the Thing row — the link table and HistoricalLocation take the
 * write — and editing a Location's coordinates writes only the Location. So the
 * scrubber showed no tick for the very change that moves the marker.
 *
 * A relocation is timed by its commit, not by HistoricalLocation `time`: that
 * field is client-settable and need not be transaction time at all. Without a
 * commit (a backend writing none), `time` is the only instant available.
 *
 * Returns oldest → newest; empty for a Thing whose history cannot be read (one
 * deleted since has no live HistoricalLocations to navigate to).
 */
export async function fetchThingLocationChanges(
  endpoint: string,
  thingId: string,
  headers: Record<string, string>
): Promise<LocationChange[]> {
  const changes: LocationChange[] = []
  const locationIds = new Set<string>()
  // Each relocation, as [instant, the Locations it moved the Thing to].
  const stays: Array<{ atMs: number; locationIds: Set<string> }> = []

  try {
    const rows = await readAll(
      `${endpoint}/Things(${encodeURIComponent(thingId)})/HistoricalLocations` +
        `?$select=id,time&$expand=Commit,Locations($select=id)`,
      headers
    )
    for (const row of rows) {
      const commit = row?.Commit as BackendCommit | undefined
      const at = commit?.date ?? (typeof row?.time === 'string' ? row.time : null)
      if (at) {
        changes.push({
          at,
          commit: commit && commit['@iot.id'] != null ? commit : null,
        })
      }
      const locations = Array.isArray(row?.Locations)
        ? (row.Locations as Record<string, unknown>[])
        : []
      const ids = new Set<string>()
      for (const location of locations) {
        const id = String(location?.['@iot.id'] ?? '')
        if (id) ids.add(id)
      }
      ids.forEach((id) => locationIds.add(id))
      const atMs = at ? Date.parse(at) : NaN
      if (Number.isFinite(atMs)) stays.push({ atMs, locationIds: ids })
    }
  } catch {
    return []
  }

  // Relocations landing in one instant are one move, to all their Locations.
  const moves = new Map<number, Set<string>>()
  for (const stay of stays) {
    const ids = moves.get(stay.atMs) ?? new Set<string>()
    stay.locationIds.forEach((id) => ids.add(id))
    moves.set(stay.atMs, ids)
  }
  const timeline = Array.from(moves.entries()).sort((a, b) => a[0] - b[0])

  /** Did the Thing stand at `locationId` at `ms`? Only then does an edit move it. */
  const stoodAt = (locationId: string, ms: number) => {
    let current: Set<string> | null = null
    for (const [atMs, ids] of timeline) {
      if (atMs > ms) break
      current = ids
    }
    return !!current?.has(locationId)
  }

  // One request per Location the Thing has ever stood at — never through the
  // Thing's path: `Things(id)/Locations?$from_to` loses the parent filter.
  const locationVersions = await Promise.all(
    Array.from(locationIds).map(async (locationId) => {
      try {
        const rows = await readAll(
          `${endpoint}/Locations(${encodeURIComponent(locationId)})` +
            `?$from_to=${encodeURIComponent(FULL_HISTORY_WINDOW)}` +
            `&$expand=Commit&$select=systemTimeValidity`,
          headers
        )
        return rows.map((row) => ({ locationId, row }))
      } catch {
        return []
      }
    })
  )

  for (const { locationId, row } of locationVersions.flat()) {
    const range = parseValidity(row?.systemTimeValidity)
    if (!range) continue
    // A Location's creation moves nothing — the relocation onto it is the
    // change, and has its tick above. Only a later edit made while the Thing
    // stood there moved the marker; an edit before it arrived or after it left
    // belongs to other Things' timelines.
    const startMs = Date.parse(range.start)
    const created = !locationVersions
      .flat()
      .some(
        (other) =>
          other.locationId === locationId &&
          Date.parse(parseValidity(other.row?.systemTimeValidity)?.start ?? '') < startMs
      )
    if (created || !stoodAt(locationId, startMs)) continue
    const commit = row?.Commit as BackendCommit | undefined
    changes.push({
      at: range.start,
      commit: commit && commit['@iot.id'] != null ? commit : null,
    })
  }

  return changes.sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
}

/**
 * Fallback history walk for backends where `$from_to` is unavailable.
 *
 * Every version reports its own `systemTimeValidity` when read with `$as_of`,
 * so asking one whole second before a version began lands in the previous one,
 * and repeating that walks the chain back to creation; a 404 means there is
 * nothing older. One second is the step because the API truncates both the
 * timestamps it prints and the `$as_of` it parses to whole seconds.
 *
 * Commit messages are not reachable this way — `$as_of` cannot expand them per
 * version — so every version comes back with a null commit.
 */
async function walkThingVersions(
  endpoint: string,
  thingId: string,
  headers: Record<string, string>,
  maxVersions = 25
): Promise<ThingVersion[]> {
  const id = encodeURIComponent(thingId)
  const versions: ThingVersion[] = []
  // `$as_of` is required even for the current version: a plain read omits
  // systemTimeValidity entirely.
  let cursor = new Date().toISOString().replace(/\.\d+Z$/, 'Z')

  for (let hop = 0; hop < maxVersions; hop += 1) {
    let range: { start: string; end: string | null } | null = null
    try {
      const response = await fetch(
        `${endpoint}/Things(${id})?$as_of=${encodeURIComponent(cursor)}&$select=systemTimeValidity`,
        { headers, cache: 'no-store' }
      )
      if (!response.ok) break
      const data = await response.json().catch(() => null)
      range = parseValidity(data?.systemTimeValidity)
    } catch {
      break
    }

    if (!range) break
    versions.push({ ...range, commit: null })

    // Step one whole second before this version began to reach the previous one.
    const previous = new Date(
      Math.floor(Date.parse(range.start) / 1000) * 1000 - 1000
    )
    const nextCursor = previous.toISOString().replace(/\.\d+Z$/, 'Z')
    // Guard against a backend that never moves the window.
    if (nextCursor >= cursor) break
    cursor = nextCursor
  }

  return versions.reverse()
}

/**
 * Last-resort commit read for a Thing: the plural `/Commits` collection,
 * falling back to the singular `/Commit`.
 *
 * On istSOS4 this yields only the *current* version's commit, so it cannot
 * describe a timeline — `fetchThingVersions` is the source for that, and every
 * version it returns already carries its own commit. This is called only when
 * that returns nothing at all, so a scrubber on an unversioned backend still
 * has one tick rather than none.
 */
export async function fetchThingCommits(
  endpoint: string,
  thingId: string,
  headers: Record<string, string>
): Promise<BackendCommit[]> {
  const id = encodeURIComponent(thingId)

  try {
    const response = await fetch(
      `${endpoint}/Things(${id})/Commits?$select=@iot.id,message,date,actionType`,
      { headers, cache: 'no-store' }
    )
    if (response.ok) {
      const data = await response.json().catch(() => null)
      if (Array.isArray(data?.value)) return data.value as BackendCommit[]
    }
  } catch {
    // Fall through to the singular endpoint below.
  }

  try {
    const response = await fetch(`${endpoint}/Things(${id})/Commit`, {
      headers,
      cache: 'no-store',
    })
    if (!response.ok) return []
    const data = await response.json().catch(() => null)
    if (Array.isArray(data?.value)) return data.value as BackendCommit[]
    if (data?.['@iot.id'] != null) return [data as BackendCommit]
    return []
  } catch {
    return []
  }
}
