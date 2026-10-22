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
 * @file asOfAdapter.ts
 *
 * Adapter layer for the As-Of (time-travel) feature.
 *
 * This file provides a single `activeAdapter` that is used by `useAsOfThing`
 * and `useAsOfCommits`. It abstracts two implementations:
 *
 *  - `mockAdapter`  — resolves data from local dummy things (for dev/demo).
 *  - `apiAdapter`   — calls the real backend `$as_of` API endpoint.
 *
 * To switch from mock → real:
 *   Set `NEXT_PUBLIC_VERSIONING_ENABLED=true` in your `.env` file.
 *
 * No hook code needs to change — only this env variable.
 */

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'

import type { Datastream, Thing } from '@/types/domain'
import { normalizedBasePath } from '@/app/home/utils'
import { getAllDataSourceTokens, getDataSourceToken } from '@/lib/dataSourceTokens'
import {
  localDummyThings,
  type LocalTimeTravelVersion,
} from '@/config/local-dummy-things'

dayjs.extend(utc)

// ---------------------------------------------------------------------------
// Shared Types (re-exported so hooks import from one place)
// ---------------------------------------------------------------------------

export type AsOfCommit = {
  id: string
  /** ISO-8601 UTC datetime of this commit */
  authoredAt: string
  message: string
  /** The commit's `author` URI, e.g. `/Users(1)`; absent when unknown. */
  author?: string
}

export type ExistenceState = 'exists' | 'not-yet-created' | 'deleted'

export type ResolvedThing = {
  thing: Thing | null
  existenceState: ExistenceState
  existenceRange: { createdAt: string | null; deletedAt: string | null }
}

/** Every Thing the map should draw at one instant. */
export type MapSnapshot = {
  /**
   * The Things that existed at the instant, as they were then. Includes Things
   * deleted since and excludes Things created since.
   */
  things: Thing[]
  /**
   * Data sources whose snapshot could not be read. Their Things are included
   * as LIVE data, flagged `__asOfLocationSource: 'live'`, so the map can say so
   * instead of passing live positions off as historical ones.
   */
  failedEndpoints: string[]
  /**
   * Data sources whose snapshot was read, but without the latest readings —
   * that read is best effort and can run out of time on a large Observation
   * history. Their markers are at the right place, with no value on them.
   */
  readingsUnavailableEndpoints: string[]
}

// ---------------------------------------------------------------------------
// Adapter Interface
// ---------------------------------------------------------------------------

export interface AsOfAdapter {
  /**
   * Resolve a Thing's state at a given point in time.
   *
   * @param thing     - The live Thing object (needed for endpoint URL and
   *                    fallback data when real API is unavailable).
   * @param asOfDate  - ISO-8601 UTC date string to resolve state at.
   * @returns A `ResolvedThing` describing what existed at that moment.
   */
  resolveThing(thing: Thing, asOfDate: string): Promise<ResolvedThing>

  /**
   * Fetch the ordered commit history for a Thing.
   * Used to populate timeline scrubber tick marks.
   *
   * @param thing - The live Thing object.
   * @returns Commits sorted oldest → newest.
   */
  fetchCommits(thing: Thing): Promise<AsOfCommit[]>

  /**
   * Resolve every Thing the map draws at a given point in time.
   *
   * @param liveThings - The live list; the fallback for any source whose
   *                     snapshot cannot be read.
   * @param asOfDate   - ISO-8601 UTC date string to resolve state at.
   */
  resolveMapThings(liveThings: Thing[], asOfDate: string): Promise<MapSnapshot>
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function thingId(thing: Thing): string {
  return String(thing['@iot.id'] ?? thing.id ?? '')
}

// ---------------------------------------------------------------------------
// Version resolution helpers (used by mockAdapter)
// ---------------------------------------------------------------------------

function resolveVersionForDate(
  versions: LocalTimeTravelVersion[],
  asOfDate: string
): LocalTimeTravelVersion | null {
  const target = dayjs.utc(asOfDate)
  if (!target.isValid()) return null

  for (const version of versions) {
    const [from, to] = version.systemTimeValidity
    const fromDt = dayjs.utc(from)
    const toDt = to ? dayjs.utc(to) : null
    const afterFrom = target.isAfter(fromDt) || target.isSame(fromDt)
    const beforeTo = toDt ? target.isBefore(toDt) : true
    if (afterFrom && beforeTo) return version
  }
  return null
}

function resolveExistenceState(
  versions: LocalTimeTravelVersion[],
  asOfDate: string
): ExistenceState {
  if (versions.length === 0) return 'exists'
  const target = dayjs.utc(asOfDate)
  const earliest = dayjs.utc(versions[0].systemTimeValidity[0])
  if (target.isBefore(earliest)) return 'not-yet-created'
  const last = versions[versions.length - 1]
  const lastEnd = last.systemTimeValidity[1]
  if (lastEnd && target.isAfter(dayjs.utc(lastEnd))) return 'deleted'
  return 'exists'
}

function extractExistenceRange(
  versions: LocalTimeTravelVersion[]
): { createdAt: string | null; deletedAt: string | null } {
  if (versions.length === 0) return { createdAt: null, deletedAt: null }
  const createdAt = versions[0].systemTimeValidity[0] ?? null
  const lastEnd = versions[versions.length - 1].systemTimeValidity[1] ?? null
  return { createdAt, deletedAt: lastEnd }
}

function applyVersionToThing(baseThing: Thing, version: LocalTimeTravelVersion): Thing {
  const versionStart = dayjs.utc(version.systemTimeValidity[0])
  const patchedDatastreams = (baseThing.Datastreams ?? []).map((ds) => {
    const filteredObs = (ds.Observations ?? []).filter((obs) => {
      const t = dayjs.utc(obs.phenomenonTime ?? obs.resultTime ?? '')
      return t.isValid() && (t.isBefore(versionStart) || t.isSame(versionStart))
    })
    const patchedSensor =
      version.sensor && ds.Sensor ? { ...ds.Sensor, name: version.sensor } : ds.Sensor

    return {
      ...ds,
      Sensor: patchedSensor,
      Observations: filteredObs.length > 0 ? filteredObs : ds.Observations?.slice(-1) ?? [],
    }
  })

  // A version's coordinates are where the Thing stood during it. The live
  // Location keeps its CRS and identity; only the position is historical.
  const patchedLocations = version.coordinates
    ? (baseThing.Locations ?? []).map((location, index) =>
        index === 0 && location.location?.type === 'Point'
          ? {
              ...location,
              location: { ...location.location, coordinates: version.coordinates },
            }
          : location
      )
    : baseThing.Locations

  return {
    ...baseThing,
    name: version.name ?? baseThing.name,
    description: version.description ?? baseThing.description,
    Locations: patchedLocations,
    Datastreams: patchedDatastreams,
  }
}

/** Infer existence range from datastream phenomenonTime when no version history exists. */
function inferExistenceRange(
  thing: Thing
): { createdAt: string | null; deletedAt: string | null } {
  const datastreams = thing.Datastreams ?? []
  let earliest: ReturnType<typeof dayjs.utc> | null = null
  for (const ds of datastreams) {
    const pt = ds.phenomenonTime
    if (!pt) continue
    const startRaw = pt.split('/')[0]
    if (!startRaw) continue
    const start = dayjs.utc(startRaw)
    if (start.isValid() && (!earliest || start.isBefore(earliest))) earliest = start
  }
  return { createdAt: earliest ? earliest.toISOString() : null, deletedAt: null }
}

// ---------------------------------------------------------------------------
// mockAdapter — reads from local-dummy-things.ts
// ---------------------------------------------------------------------------

const mockAdapter: AsOfAdapter = {
  async resolveThing(thing, asOfDate) {
    const id = thingId(thing)
    const dummyMatch = localDummyThings.find(
      (d) => String(d['@iot.id'] ?? d.id ?? '') === id
    )

    if (dummyMatch?.properties?.timeTravel?.versions) {
      const versions = dummyMatch.properties.timeTravel.versions
      const version = resolveVersionForDate(versions, asOfDate)
      const existenceRange = extractExistenceRange(versions)

      if (version) {
        return {
          thing: applyVersionToThing(thing, version),
          existenceState: 'exists',
          existenceRange,
        }
      }

      return {
        thing: { ...thing, Datastreams: [] },
        existenceState: resolveExistenceState(versions, asOfDate),
        existenceRange,
      }
    }

    // Real thing in mock mode — infer range from phenomenonTime
    const existenceRange = inferExistenceRange(thing)
    if (existenceRange.createdAt) {
      const target = dayjs.utc(asOfDate)
      const earliest = dayjs.utc(existenceRange.createdAt)
      if (target.isBefore(earliest)) {
        return {
          thing: { ...thing, Datastreams: [] },
          existenceState: 'not-yet-created',
          existenceRange,
        }
      }
    }

    return { thing, existenceState: 'exists', existenceRange }
  },

  async fetchCommits(thing) {
    const id = thingId(thing)
    const dummyMatch = localDummyThings.find(
      (d) => String(d['@iot.id'] ?? d.id ?? '') === id
    )

    if (dummyMatch?.properties?.timeTravel?.commits) {
      return [...dummyMatch.properties.timeTravel.commits].sort(
        (a, b) => dayjs.utc(a.authoredAt).valueOf() - dayjs.utc(b.authoredAt).valueOf()
      )
    }

    return []
  },

  async resolveMapThings(liveThings, asOfDate) {
    // The same resolution the panel gets, per Thing, so a marker and its panel
    // always agree on whether the Thing existed and where it stood.
    const resolved = await Promise.all(
      liveThings.map(async (thing) => {
        const result = await mockAdapter.resolveThing(thing, asOfDate)
        if (result.existenceState !== 'exists' || !result.thing) return null
        const id = thingId(thing)
        const hasVersions = localDummyThings.some(
          (d) =>
            String(d['@iot.id'] ?? d.id ?? '') === id &&
            !!d.properties?.timeTravel?.versions?.length
        )
        // Only the dummy Things carry a position history. A real Thing in mock
        // mode is live data and is flagged so the map does not present it as
        // historical.
        return {
          ...result.thing,
          __asOfLocationSource: hasVersions ? 'history' : 'live',
        } satisfies Thing
      })
    )
    return {
      things: resolved.filter((thing): thing is NonNullable<typeof thing> => !!thing),
      failedEndpoints: [],
      readingsUnavailableEndpoints: [],
    }
  },
}

// ---------------------------------------------------------------------------
// apiAdapter — reads the real backend `$as_of` data through the app's own
// server routes (/api/as-of/*).
//
// It cannot call the API directly: NEXT_PUBLIC_ISTSOS4_URL is the API's Docker
// network name, which the browser cannot resolve, and the API registers no CORS
// middleware — so a direct client-side fetch always throws. Every such failure
// used to be swallowed and answered with LIVE data, which is why the datastream
// table never changed with the selected date. The hop below runs the request
// inside the Next server, where the name resolves and CORS does not apply.
//
// Backend Commit shape (from GET /Things(id)/Commit):
//   { "@iot.id": 2, "author": "/Users(1)", "message": "...", "date": "...", "actionType": "CREATE" }
//
// NOTE: Backend uses `date`, frontend type uses `authoredAt`. We map here.
// ---------------------------------------------------------------------------

type BackendCommit = {
  '@iot.id': number | string
  message: string
  /** ISO date string — maps to AsOfCommit.authoredAt */
  date: string
  actionType: string
  /** The committing user's `uri`, e.g. `/Users(1)`, or `anonymous`. */
  author?: string
}

const asOfThingApiPath = `${normalizedBasePath}/api/as-of/thing`
const asOfCommitsApiPath = `${normalizedBasePath}/api/as-of/commits`
const asOfThingsApiPath = `${normalizedBasePath}/api/as-of/things`

/** POST to one of our own as-of routes. Throws on a transport-level failure. */
async function postAsOf<T>(
  path: string,
  payload: Record<string, unknown>
): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`As-of request failed (${response.status})`)
  }

  const data = await response.json().catch(() => null)
  if (!data) throw new Error('Malformed as-of response')
  return data as T
}

/**
 * Re-attaches the source metadata (`__sourceId` / `__sourceName` /
 * `__sourceEndpoint`) that the live thing carries and the raw API response does
 * not. Downstream code resolves which data source to query from these, so a
 * snapshot thing without them would be unusable.
 */
function withSourceMeta(resolved: Thing, live: Thing): Thing {
  const meta = {
    __sourceId: live.__sourceId,
    __sourceName: live.__sourceName,
    __sourceEndpoint: live.__sourceEndpoint,
  }
  const datastreams = Array.isArray(resolved.Datastreams)
    ? resolved.Datastreams.map((ds: Datastream) => ({ ...ds, ...meta }))
    : resolved.Datastreams

  return { ...resolved, ...meta, Datastreams: datastreams }
}

/** One version of a Thing in transaction time, as the as-of routes return it. */
type BackendVersion = {
  start: string
  end: string | null
  commit: BackendCommit | null
}

/**
 * Derive a Thing's existence range from its VERSION history — i.e. transaction
 * time, which is the axis `$as_of` filters on. This is the correct source for
 * "not-yet-created vs deleted", unlike phenomenonTime (when measurements were
 * taken), which can be years off from when the row was actually written.
 *
 * The versions come from the `Thing_traveltime` view, which retains a deleted
 * Thing's rows — so unlike the commits collection (which reads the current
 * table, and is empty once a Thing is gone) this can actually observe a
 * deletion. The last version's closed `end` IS the instant the Thing stopped
 * existing; a trailing DELETE commit is the coarser cross-check behind it.
 */
function existenceRangeFromVersions(versions: BackendVersion[]): {
  createdAt: string | null
  deletedAt: string | null
} {
  if (versions.length === 0) return { createdAt: null, deletedAt: null }
  const sorted = [...versions].sort(
    (a, b) => dayjs.utc(a.start).valueOf() - dayjs.utc(b.start).valueOf()
  )
  const last = sorted[sorted.length - 1]
  const deletedByCommit =
    String(last.commit?.actionType ?? '').toUpperCase() === 'DELETE'
      ? (last.commit?.date ?? null)
      : null
  return {
    createdAt: sorted[0]?.start ?? null,
    // A still-current version has an open end; only a closed one is a deletion.
    deletedAt: last.end ?? deletedByCommit,
  }
}

type ThingAsOfResponse = {
  ok: boolean
  status?: number
  thing?: Thing | null
  versions?: BackendVersion[]
  error?: string
}

const apiAdapter: AsOfAdapter = {
  async resolveThing(thing, asOfDate) {
    const id = thingId(thing)
    const endpoint = (thing.__sourceEndpoint ?? '').replace(/\/$/, '')
    if (!endpoint) {
      return { thing, existenceState: 'exists', existenceRange: { createdAt: null, deletedAt: null } }
    }

    // A failure is reported, never papered over with live data: showing live
    // rows under a "snapshot" banner is indistinguishable from a working
    // snapshot, which is exactly the bug this adapter used to have.
    const payload = await postAsOf<ThingAsOfResponse>(asOfThingApiPath, {
      endpoint,
      thingId: id,
      asOfDate,
      token: getDataSourceToken(endpoint),
    })

    if (!payload.ok) {
      throw new Error(payload.error ?? 'Could not resolve snapshot')
    }

    if (payload.status === 404) {
      // The backend returns 404 when the thing didn't exist at that time.
      // Determine "not-yet-created vs deleted" from the VERSION history
      // (transaction time — the axis $as_of filters on), NOT phenomenonTime.
      // Falls back to phenomenonTime only when no version history is available.
      const versions = payload.versions ?? []
      const existenceRange =
        versions.length > 0
          ? existenceRangeFromVersions(versions)
          : inferExistenceRange(thing)
      const target = dayjs.utc(asOfDate)
      const createdAt = existenceRange.createdAt
        ? dayjs.utc(existenceRange.createdAt)
        : null
      const existenceState: ExistenceState =
        createdAt && target.isBefore(createdAt) ? 'not-yet-created' : 'deleted'
      return { thing: { ...thing, Datastreams: [] }, existenceState, existenceRange }
    }

    if (!payload.thing) {
      throw new Error('Snapshot response contained no thing')
    }

    const resolved = withSourceMeta(payload.thing, thing)
    return {
      thing: resolved,
      existenceState: 'exists',
      existenceRange: inferExistenceRange(resolved),
    }
  },

  async fetchCommits(thing) {
    const id = thingId(thing)
    const endpoint = (thing.__sourceEndpoint ?? '').replace(/\/$/, '')
    if (!endpoint) return []

    const payload = await postAsOf<{
      ok: boolean
      commits?: BackendCommit[]
      versions?: BackendVersion[]
      locationChanges?: Array<{ at: string; commit: BackendCommit | null }>
    }>(asOfCommitsApiPath, {
      endpoint,
      thingId: id,
      token: getDataSourceToken(endpoint),
    })

    // The timeline is built from version boundaries, not from the commits
    // collection: istSOS4's `/Commits` returns only the commit of the *current*
    // version, so an edited Thing would look like it has no history before its
    // last edit — collapsing the scrubber to the span since that edit. Each
    // version start is a real change, and carries the commit that made it.
    const versionTicks = (payload.versions ?? [])
      .filter((version) => !!version?.start)
      .map((version) => ({
        id: version.commit?.['@iot.id'] != null
          ? String(version.commit['@iot.id'])
          : `v:${version.start}`,
        // The version boundary, not the commit's own `date`: they agree for an
        // UPDATE but the scrubber is positioned in transaction time, which is
        // what the boundary is.
        authoredAt: version.start,
        // Commit messages are free text from the backend and are not
        // translated; this stand-in matches that.
        message: version.commit?.message ?? 'Changed',
        author: version.commit?.author,
      }))

    const ticks = versionTicks.length
      ? versionTicks
      : (payload.commits ?? [])
          .filter((commit) => !!commit?.date)
          .map((commit) => ({
            id: String(commit['@iot.id']),
            // Backend field is `date`, our type uses `authoredAt`
            authoredAt: commit.date,
            message: commit.message,
            author: commit.author,
          }))

    // Where the Thing stood changes without a Thing version (see
    // fetchThingLocationChanges), so those changes are ticks of their own. A
    // commit already on the timeline is not repeated, and nothing is placed
    // before the Thing existed — the left bound of the scrubber stays its
    // creation, where a Location made ahead of it would otherwise pull it.
    const seenCommits = new Set(ticks.map((tick) => tick.id))
    const seenInstants = new Set(
      ticks.map((tick) => Math.floor(dayjs.utc(tick.authoredAt).valueOf() / 1000))
    )
    const createdAtMs = versionTicks.length
      ? Math.min(...versionTicks.map((tick) => dayjs.utc(tick.authoredAt).valueOf()))
      : -Infinity
    for (const change of payload.locationChanges ?? []) {
      const atMs = dayjs.utc(change.at).valueOf()
      if (!Number.isFinite(atMs) || atMs < createdAtMs) continue
      const id = change.commit?.['@iot.id'] != null
        ? String(change.commit['@iot.id'])
        : `l:${change.at}`
      const second = Math.floor(atMs / 1000)
      if (seenCommits.has(id) || (!change.commit && seenInstants.has(second))) continue
      seenCommits.add(id)
      seenInstants.add(second)
      ticks.push({
        id,
        authoredAt: change.at,
        // Free backend text, like the version ticks above.
        message: change.commit?.message ?? 'Location changed',
        author: change.commit?.author,
      })
    }

    return ticks.sort(
      (a, b) => dayjs.utc(a.authoredAt).valueOf() - dayjs.utc(b.authoredAt).valueOf()
    )
  },

  async resolveMapThings(liveThings, asOfDate) {
    const payload = await postAsOf<{
      ok: boolean
      error?: string
      things?: Thing[]
      sources?: Array<{
        endpoint: string
        error: string | null
        readingsUnavailable?: boolean
      }>
    }>(asOfThingsApiPath, {
      asOfDate,
      tokens: getAllDataSourceTokens(),
    })

    if (!payload.ok) {
      throw new Error(payload.error ?? 'Could not resolve the map snapshot')
    }

    // A source whose snapshot failed keeps its live Things — flagged, so the
    // map marks them approximate — rather than vanishing from the map, which
    // would read as "none of these existed then".
    const failedEndpoints = (payload.sources ?? [])
      .filter((source) => !!source.error)
      .map((source) => source.endpoint.replace(/\/+$/, ''))
    const failed = new Set(failedEndpoints)
    const fallback = liveThings
      .filter((thing) =>
        failed.has(String(thing.__sourceEndpoint ?? '').replace(/\/+$/, ''))
      )
      .map((thing) => ({ ...thing, __asOfLocationSource: 'live' as const }))

    const readingsUnavailableEndpoints = (payload.sources ?? [])
      .filter((source) => !source.error && !!source.readingsUnavailable)
      .map((source) => source.endpoint.replace(/\/+$/, ''))

    return {
      things: [...(payload.things ?? []), ...fallback],
      failedEndpoints,
      readingsUnavailableEndpoints,
    }
  },
}

// ---------------------------------------------------------------------------
// Active adapter — controlled by env variable
// ---------------------------------------------------------------------------

/**
 * Set `NEXT_PUBLIC_VERSIONING_ENABLED=true` in `.env` to switch from
 * mock data to the real backend `$as_of` API.
 *
 * Default: `false` (mock mode — works with no backend).
 */
const VERSIONING_ENABLED =
  process.env.NEXT_PUBLIC_VERSIONING_ENABLED === 'true'

export const activeAdapter: AsOfAdapter = VERSIONING_ENABLED ? apiAdapter : mockAdapter

/** Expose flag so components can show debug hints in development. */
export const isVersioningEnabled = VERSIONING_ENABLED
