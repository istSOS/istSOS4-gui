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
 * and `useAsOfCommits`. Enabled deployments use the backend's historical
 * reads; disabled deployments return live data without historical requests.
 */
import type { Datastream, Thing } from '@/types/domain'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'

import { normalizedBasePath } from '@/app/home/utils'

import { isVersioningEnabled } from '@/config/versioning'

import {
  getAllDataSourceTokens,
  getDataSourceToken,
} from '@/lib/dataSourceTokens'
import { resolveDeletion, type Deletion } from '@/lib/deletion'

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
  /**
   * Set on the tick where the Thing was deleted: `recorded` when the history
   * holds the DELETE row, `inferred` when its last version just ends.
   */
  deletion?: 'recorded' | 'inferred'
}

export type ExistenceState = 'exists' | 'not-yet-created' | 'deleted'

/** When a Thing came to exist and stopped existing, in transaction time. */
export type ExistenceRange = {
  createdAt: string | null
  deletedAt: string | null
  /** How it was deleted, when its version history says so (lib/deletion). */
  deletion?: Deletion | null
}

export type ResolvedThing = {
  thing: Thing | null
  existenceState: ExistenceState
  existenceRange: ExistenceRange
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

/** Infer existence range from datastream phenomenonTime when no version history exists. */
function inferExistenceRange(thing: Thing): {
  createdAt: string | null
  deletedAt: string | null
} {
  const datastreams = thing.Datastreams ?? []
  let earliest: ReturnType<typeof dayjs.utc> | null = null
  for (const ds of datastreams) {
    const pt = ds.phenomenonTime
    if (!pt) continue
    const startRaw = pt.split('/')[0]
    if (!startRaw) continue
    const start = dayjs.utc(startRaw)
    if (start.isValid() && (!earliest || start.isBefore(earliest)))
      earliest = start
  }
  return {
    createdAt: earliest ? earliest.toISOString() : null,
    deletedAt: null,
  }
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
  /** Bounds print alike; with a DELETE commit, the row a delete writes. */
  degenerate?: boolean
  commit: BackendCommit | null
}

/**
 * The versions, oldest first, in the shape the shared deletion rule reads.
 *
 * The routes read the whole history — every page, over a window reaching past
 * the present — so the rule may also infer a deletion from a closed last
 * version, exactly as the history page does for a window that reaches today.
 */
function resolveVersions(versions: BackendVersion[]) {
  const rows = versions
    .map((version) => ({
      ...version,
      validity: {
        start: version.start,
        end: version.end,
        degenerate: !!version.degenerate,
      },
    }))
    .sort((a, b) => dayjs.utc(a.start).valueOf() - dayjs.utc(b.start).valueOf())
  return resolveDeletion(rows, true)
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
 * deletion: the DELETE row when the backend writes one, otherwise the closed
 * end of the last version (see lib/deletion).
 */
function existenceRangeFromVersions(versions: BackendVersion[]): ExistenceRange {
  const { versions: lived, deletion } = resolveVersions(versions)
  return {
    createdAt: lived[0]?.start ?? null,
    deletedAt: deletion?.at ?? null,
    deletion,
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
      return {
        thing,
        existenceState: 'exists',
        existenceRange: { createdAt: null, deletedAt: null },
      }
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
      return {
        thing: { ...thing, Datastreams: [] },
        existenceState,
        existenceRange,
      }
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
    // version start is a real change, and carries the commit that made it. A
    // delete's own row is not a version: it is split off here and becomes the
    // deletion tick below.
    const { versions: lived, deletion } = resolveVersions(payload.versions ?? [])
    const versionTicks = lived
      .filter((version) => !!version?.start)
      .map((version) => ({
        id:
          version.commit?.['@iot.id'] != null
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

    const ticks: AsOfCommit[] = versionTicks.length
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

    // How the Thing ended is a change too. Landing on its tick shows the Thing
    // gone, just as every other tick shows the result of its change.
    if (deletion) {
      ticks.push({
        id: deletion.commit?.['@iot.id'] != null
          ? String(deletion.commit['@iot.id'])
          : `d:${deletion.at}`,
        authoredAt: deletion.at,
        // Free backend text, like the version ticks above.
        message: deletion.commit?.message ?? 'Deleted',
        author: deletion.commit?.author,
        deletion: deletion.recorded ? 'recorded' : 'inferred',
      })
    }

    // Where the Thing stood changes without a Thing version (see
    // fetchThingLocationChanges), so those changes are ticks of their own. A
    // commit already on the timeline is not repeated, and nothing is placed
    // before the Thing existed — the left bound of the scrubber stays its
    // creation, where a Location made ahead of it would otherwise pull it.
    const seenCommits = new Set(ticks.map((tick) => tick.id))
    const seenInstants = new Set(
      ticks.map((tick) =>
        Math.floor(dayjs.utc(tick.authoredAt).valueOf() / 1000)
      )
    )
    const createdAtMs = versionTicks.length
      ? Math.min(
          ...versionTicks.map((tick) => dayjs.utc(tick.authoredAt).valueOf())
        )
      : -Infinity
    for (const change of payload.locationChanges ?? []) {
      const atMs = dayjs.utc(change.at).valueOf()
      if (!Number.isFinite(atMs) || atMs < createdAtMs) continue
      const id =
        change.commit?.['@iot.id'] != null
          ? String(change.commit['@iot.id'])
          : `l:${change.at}`
      const second = Math.floor(atMs / 1000)
      if (seenCommits.has(id) || (!change.commit && seenInstants.has(second)))
        continue
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
      (a, b) =>
        dayjs.utc(a.authoredAt).valueOf() - dayjs.utc(b.authoredAt).valueOf()
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

// Guard adapter calls as well as the UI: disabled mode never reads history.
const liveAdapter: AsOfAdapter = {
  async resolveThing(thing) {
    return {
      thing,
      existenceState: 'exists',
      existenceRange: { createdAt: null, deletedAt: null },
    }
  },
  async fetchCommits() {
    return []
  },
  async resolveMapThings(liveThings) {
    return {
      things: liveThings,
      failedEndpoints: [],
      readingsUnavailableEndpoints: [],
    }
  },
}

export const activeAdapter: AsOfAdapter = isVersioningEnabled
  ? apiAdapter
  : liveAdapter
