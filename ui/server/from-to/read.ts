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
 * @file server/from-to/read.ts
 *
 * Server-side reads for the entity history page.
 *
 * Runs inside the Next server for the same reason the As-Of reads do: the API
 * is reached over the Docker network name in NEXT_PUBLIC_ISTSOS4_URL, which a
 * browser cannot resolve, and the API sends no CORS headers.
 *
 * One request answers a whole page. `$from_to` returns every version whose
 * validity overlaps the window, each carrying the entity's full body, and
 * `$expand=Commit` attaches the commit that produced it — so the timeline, the
 * version list and every diff come from a single round trip, with no request
 * per compared pair.
 *
 * Two things this module is careful about, both measured against a local
 * istSOS4:
 *
 *   - `$expand` accepts *only* `Commit`. Any other expand answers 500, so
 *     related entities are separate reads, never a nested tree.
 *   - Nothing is ever read through a parent path. A keyed child
 *     (`/Things(1)/Datastreams(3)`) returns each version once per parent
 *     version, and a child *collection* can lose the parent filter altogether —
 *     `/Things(1)/Locations?$from_to=…` answers with all five Locations in the
 *     system for a Thing that owns one. So related entities are resolved by id
 *     first, without `$from_to`, and then read one at a time by their own path.
 */

import {
  historyPath,
  isNestedCollection,
  entityIdOf,
  entitySetOf,
} from '@/features/from-to/lib/entityPath'
import {
  FULL_HISTORY_WINDOW,
  formatWindow,
  validateWindow,
  type HistoryWindow,
} from '@/features/from-to/lib/historyWindow'
import { parseValidity } from '@/lib/systemTimeValidity'
import {
  readVersions,
  type EntityVersion,
} from '@/features/from-to/lib/versionRows'
import {
  hasNameField,
  isVersionedSet,
  relationToSet,
} from '@/features/from-to/lib/versionedEntities'

/** `$expand=Commit` is the only expand `$from_to` accepts. */
const COMMIT_EXPAND = 'Commit'

/** Matches the API's own default page size (TOP_VALUE). */
export const DEFAULT_PAGE_SIZE = 100

export type HistoryResult =
  | {
      kind: 'history'
      /** Versions, de-duplicated and ordered oldest first. */
      versions: EntityVersion[]
      /** The path actually requested, after any rewrite. */
      path: string
      /** Entity set and key the page is showing. */
      entitySet: string | null
      entityId: string | null
      /** True when the API has more versions than were returned. */
      hasMore: boolean
      /**
       * How many versions the window holds in total, counted by the API over
       * distinct `(id, systemTimeValidity)` pairs — not just how many were
       * returned. Null when the count could not be read.
       */
      total: number | null
    }
  | { kind: 'error'; status: number; error: string }

function buildHistoryUrl(
  endpoint: string,
  path: string,
  window: HistoryWindow,
  pageSize: number,
): string | null {
  const fromTo = formatWindow(window)
  if (!fromTo) return null

  // `$count` rides along on the request already being made, so the page can say
  // "showing 100 of 412" instead of a dead-end "there are more".
  return (
    `${endpoint}/${path}` +
    `?$from_to=${encodeURIComponent(fromTo)}` +
    `&$expand=${COMMIT_EXPAND}` +
    `&$top=${pageSize}` +
    `&$count=true`
  )
}

/**
 * Every version of one entity (or collection) inside a window.
 *
 * A failure is reported rather than thrown so the page can distinguish "this
 * backend has versioning switched off" from "the window was rejected" — both of
 * which arrive as a 500 with no usable message, which is why the window is
 * validated here before anything is sent.
 */
export async function fetchEntityHistory(
  endpoint: string,
  requestedPath: string,
  window: HistoryWindow,
  headers: Record<string, string>,
  pageSize: number = DEFAULT_PAGE_SIZE,
): Promise<HistoryResult> {
  const problems = validateWindow(window)
  if (problems.length > 0) {
    const first = problems[0]
    return {
      kind: 'error',
      status: 400,
      error:
        first.reason === 'after-to'
          ? 'The start of the window must be before its end.'
          : `The ${first.field} of the window is ${first.reason}.`,
    }
  }

  const path = historyPath(requestedPath)
  if (!path) {
    return {
      kind: 'error',
      status: 400,
      error: isNestedCollection(requestedPath)
        ? 'History cannot be read through a parent. Resolve the related entities first, then read each by its own path.'
        : 'Unreadable entity path',
    }
  }

  // Not every collection is versioned. `Commits` is the one a hand-written link
  // is likeliest to reach — a commit causes versions rather than having them —
  // and the API answers 400 for it. Saying so here costs no round trip.
  const set = entitySetOf(path)
  if (!isVersionedSet(set)) {
    return {
      kind: 'error',
      status: 400,
      error: `${set ?? path} does not keep a version history.`,
    }
  }

  const url = buildHistoryUrl(endpoint, path, window, pageSize)
  if (!url) {
    return { kind: 'error', status: 400, error: 'Unusable history window' }
  }

  let response: Response
  try {
    response = await fetch(url, { headers, cache: 'no-store' })
  } catch (error: unknown) {
    return {
      kind: 'error',
      status: 502,
      error: error instanceof Error ? error.message : String(error),
    }
  }

  if (!response.ok) {
    // The API answers every $from_to problem with a bare 500, including the
    // case where this deployment has versioning switched off and there is no
    // systemTimeValidity column at all. Say so, since the body will not.
    return {
      kind: 'error',
      status: response.status,
      error:
        response.status === 500
          ? 'The data source rejected the history request. It may have versioning disabled.'
          : `${response.status} ${response.statusText}`.trim(),
    }
  }

  const payload = await response.json().catch(() => null)
  if (!payload || typeof payload !== 'object') {
    return { kind: 'error', status: 502, error: 'Malformed response from data source' }
  }

  const body = payload as Record<string, unknown>
  const count = body['@iot.count']

  return {
    kind: 'history',
    versions: readVersions(body.value),
    path,
    entitySet: entitySetOf(path),
    entityId: entityIdOf(path),
    hasMore: typeof body['@iot.nextLink'] === 'string',
    total: typeof count === 'number' ? count : null,
  }
}

/**
 * How many versions a path has inside a window, without fetching them.
 *
 * The path must be one `historyPath()` accepts. Counting through a parent looks
 * like a cheap way to badge a whole rail at once, and it is wrong: on a
 * many-to-many navigation `$count` reports the whole collection. Measured on a
 * local istSOS4, where Thing 1 owns one Location and the system holds five,
 * `/Things(1)/Locations?$from_to=…&$count=true` answers 5.
 *
 * Returns `null` when the count cannot be read or the path is not safe, so a
 * badge can be left blank rather than show a wrong number.
 */
export async function fetchVersionCount(
  endpoint: string,
  requestedPath: string,
  window: HistoryWindow,
  headers: Record<string, string>,
): Promise<number | null> {
  const fromTo = formatWindow(window)
  if (!fromTo) return null

  const path = historyPath(requestedPath)
  if (!path) return null

  const url =
    `${endpoint}/${path}` +
    `?$from_to=${encodeURIComponent(fromTo)}` +
    `&$count=true&$top=1&$select=@iot.id`

  try {
    const response = await fetch(url, { headers, cache: 'no-store' })
    if (!response.ok) return null
    const payload = await response.json().catch(() => null)
    const count = (payload as Record<string, unknown> | null)?.['@iot.count']
    return typeof count === 'number' ? count : null
  } catch {
    return null
  }
}

/**
 * When an entity's earliest recorded version begins, across all of time.
 *
 * The history dialog opens on a window fitted to this rather than on a fixed
 * "last 30 days", which goes empty for any entity last touched before that —
 * which, on seeded data, is most of them. One row is enough: ordering by
 * validity ascending puts the oldest first.
 *
 * Returns `null` when the entity has no readable history, leaving the caller to
 * fall back to its own default.
 */
export async function fetchEarliestVersion(
  endpoint: string,
  requestedPath: string,
  headers: Record<string, string>,
): Promise<string | null> {
  const path = historyPath(requestedPath)
  if (!path || !isVersionedSet(entitySetOf(path))) return null

  const fromTo = formatWindow(FULL_HISTORY_WINDOW)
  if (!fromTo) return null

  const url =
    `${endpoint}/${path}` +
    `?$from_to=${encodeURIComponent(fromTo)}` +
    `&$select=systemTimeValidity` +
    `&$orderby=systemTimeValidity asc` +
    `&$top=1`

  try {
    const response = await fetch(url, { headers, cache: 'no-store' })
    if (!response.ok) return null

    const payload = await response.json().catch(() => null)
    const rows = (payload as Record<string, unknown> | null)?.value
    if (!Array.isArray(rows) || rows.length === 0) return null

    const validity = parseValidity(
      (rows[0] as Record<string, unknown>)?.systemTimeValidity,
    )
    return validity?.start ?? null
  } catch {
    return null
  }
}

/** One related entity, ready for a rail row. */
export type RelatedEntity = {
  /** Its own top-level path, e.g. `Datastreams(3)` — never through the parent. */
  path: string
  id: string
  /** Display name, or empty for the types that have none. */
  name: string
  /** Versions inside the window, or `null` when the count could not be read. */
  count: number | null
}

/** Related entities grouped by the relation that reached them. */
export type RelatedGroup = {
  /** Navigation-link name, e.g. `Datastreams`. */
  relation: string
  /** The collection it addresses. */
  set: string
  /** How many related entities exist, regardless of how many are listed. */
  total: number | null
  /** True when the relation is too large to enumerate — see below. */
  tooMany: boolean
  /**
   * True when a too-large relation can still report its changes in the window
   * (`fetchChangeCount`): only relations with a key column on the child can.
   */
  countable: boolean
  items: RelatedEntity[]
}

/**
 * Above this, a relation is reported by size instead of being listed.
 *
 * Not an arbitrary tidiness rule: a Datastream on a local istSOS4 has 2016
 * Observations. Listing them would mean a sidebar of thousands of rows and a
 * version count request for each, to answer a question nobody asked. The count
 * still tells the reader the relation is there and how big it is.
 */
const MAX_LISTED_RELATIONS = 25

/**
 * The entities related to one entity, each with its version count.
 *
 * Two steps, and the order matters. Relations are discovered from the entity's
 * own `@iot.navigationLink` keys, so this works for all nine versioned types
 * without a per-type table. Then each relation is read **without** `$from_to`
 * to get ids and names, because that is the only form that filters by parent
 * correctly — under `$from_to` a many-to-many navigation returns the whole
 * collection. Only then is each child counted, by its own top-level path.
 *
 * `$filter=Thing/id eq 1` would collapse this to one request per relation, but
 * the API answers 404 for a navigation-property filter on a traveltime view.
 */
export async function fetchRelatedEntities(
  endpoint: string,
  parentPath: string,
  window: HistoryWindow,
  headers: Record<string, string>,
): Promise<RelatedGroup[]> {
  let entity: Record<string, unknown> | null = null
  try {
    const response = await fetch(`${endpoint}/${parentPath}`, {
      headers,
      cache: 'no-store',
    })
    if (!response.ok) return []
    entity = (await response.json().catch(() => null)) as Record<string, unknown> | null
  } catch {
    return []
  }
  if (!entity) return []

  const relations = Object.keys(entity)
    .filter((key) => key.endsWith('@iot.navigationLink'))
    .map((key) => key.slice(0, -'@iot.navigationLink'.length))
    .map((relation) => ({ relation, set: relationToSet(relation) }))
    .filter((entry): entry is { relation: string; set: string } => entry.set !== null)

  const groups: RelatedGroup[] = await Promise.all(
    relations.map(async ({ relation, set }): Promise<RelatedGroup> => {
      const related = await fetchRelatedEntityIds(
        endpoint,
        parentPath,
        relation,
        set,
        headers,
      )
      if (!related || related.items.length === 0) {
        return { relation, set, total: related?.total ?? null, tooMany: false, countable: false, items: [] }
      }

      const total = related.total ?? related.items.length

      // Too large to enumerate: report the size and spend no count requests
      // here. Its change count, where one exists, is a separate request, so a
      // slow count on a huge relation never holds up the rest of the rail.
      if (total > MAX_LISTED_RELATIONS) {
        const countable = parentKeyColumn(entitySetOf(parentPath), set) !== null
        return { relation, set, total, tooMany: true, countable, items: [] }
      }

      const counts = await Promise.all(
        related.items.map((entry) =>
          fetchVersionCount(endpoint, `${set}(${entry.id})`, window, headers),
        ),
      )

      return {
        relation,
        set,
        total,
        tooMany: false,
        countable: false,
        items: related.items.map((entry, index) => ({
          path: `${set}(${entry.id})`,
          id: entry.id,
          name: entry.name,
          count: counts[index],
        })),
      }
    }),
  )

  return groups.filter((group) => group.items.length > 0 || group.tooMany)
}

/**
 * The column on a child row that holds its parent's id, per parent set and
 * child set — the only way to scope a child collection to one parent under
 * `$from_to`.
 *
 * Not the parent path: under `$from_to`, `Datastreams(7)/Observations` repeats
 * every row once per version of the Datastream, and `$filter=Datastream/id eq 7`
 * answers 404 on a traveltime view. A plain column filter does neither — all of
 * these were checked against a local istSOS4, and each answers a count.
 * Many-to-many relations (Thing ↔ Location) have no such column; they are left
 * out, and a large one keeps the plain "too many to list" line.
 */
const PARENT_KEY_COLUMNS: Record<string, Record<string, string>> = {
  Datastreams: { Observations: 'datastream_id' },
  FeaturesOfInterest: { Observations: 'featuresofinterest_id' },
  Things: { Datastreams: 'thing_id', HistoricalLocations: 'thing_id' },
  Sensors: { Datastreams: 'sensor_id' },
  ObservedProperties: { Datastreams: 'observedproperty_id' },
  Networks: { Datastreams: 'network_id' },
}

/** The key column scoping `childSet` to one entity of `parentSet`, if any. */
export function parentKeyColumn(
  parentSet: string | null,
  childSet: string,
): string | null {
  if (!parentSet) return null
  return PARENT_KEY_COLUMNS[parentSet]?.[childSet] ?? null
}

/** A change count reads two whole collections; past this it gives up. */
const CHANGE_COUNT_TIMEOUT_MS = 10_000

/**
 * How far behind the present the counts are taken. Both are read as of one
 * instant that has already passed, so rows written while the two requests are
 * in flight cannot land in one count and not the other; it also keeps the
 * instant out of the future, which `$as_of` rejects with a 500.
 */
const SETTLED_LAG_MS = 2_000

async function readCount(
  url: string,
  headers: Record<string, string>,
): Promise<number | null> {
  try {
    const response = await fetch(url, {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(CHANGE_COUNT_TIMEOUT_MS),
    })
    if (!response.ok) return null
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null
    const count = payload?.['@iot.count']
    return typeof count === 'number' ? count : null
  } catch {
    return null
  }
}

/**
 * How many times a parent's children changed inside a window — edits plus
 * deletions — without listing a single child.
 *
 * Two counts at one instant `T` (the window's end, or just before now):
 *
 * - `V`, the child versions overlapping `[from, T]`;
 * - `E`, the children that exist at `T`.
 *
 * A child edited k times inside the window has k+1 versions there and counts
 * once in `E`, so it contributes exactly k. One created inside the window
 * contributes its edits the same way; one deleted inside it is missing from
 * `E`, so its deletion counts as one change. Unchanged children contribute 0.
 * `V − E` is therefore every edit and deletion in the window — checked against
 * the database itself at full precision, e.g. Datastream 7's 6057 versions
 * (4041 both ways). The window is `[from, T)`, end excluded, exactly as the
 * API's `$from_to` compiles it (`tstzrange(from, to)`), and `$as_of T` reads
 * the state that holds just after it, so a change landing at `T` itself is
 * outside the window in both counts.
 *
 * It counts changes, not distinct children: one Observation edited twice is 2.
 * Counting distinct ones would mean reading every version, because the API
 * cannot filter versions by when they began.
 *
 * Returns `null` — never a guess — when the relation has no key column, a
 * count fails or times out, or the counts disagree (a negative difference).
 */
export async function fetchChangeCount(
  endpoint: string,
  parentPath: string,
  childSet: string,
  window: HistoryWindow,
  headers: Record<string, string>,
  now: number = Date.now(),
): Promise<number | null> {
  const path = historyPath(parentPath)
  if (!path) return null
  const column = parentKeyColumn(entitySetOf(path), childSet)
  const id = entityIdOf(path)
  // Ids are interpolated into `$filter`, so only plain integers go through.
  if (!column || !id || !/^\d+$/.test(id)) return null

  const settledEnd = Math.min(Date.parse(window.to), now - SETTLED_LAG_MS)
  if (!Number.isFinite(settledEnd) || settledEnd < Date.parse(window.from)) return null
  const at = new Date(settledEnd).toISOString()
  const fromTo = formatWindow({ from: window.from, to: at })
  if (!fromTo) return null
  const instant = fromTo.slice(fromTo.indexOf('/') + 1)

  const scope =
    `&$filter=${encodeURIComponent(`${column} eq ${id}`)}` +
    `&$count=true&$top=1&$select=@iot.id`

  const [versions, existing] = await Promise.all([
    readCount(
      `${endpoint}/${childSet}?$from_to=${encodeURIComponent(fromTo)}${scope}`,
      headers,
    ),
    readCount(
      `${endpoint}/${childSet}?$as_of=${encodeURIComponent(instant)}${scope}`,
      headers,
    ),
  ])

  if (versions === null || existing === null) return null
  const changes = versions - existing
  return changes >= 0 ? changes : null
}

/**
 * The ids and names of a parent's related entities, e.g. every Datastream of a
 * Thing.
 *
 * Read *without* `$from_to`, which is the whole point: the plain navigation
 * path filters by parent correctly, while the same path under `$from_to` can
 * return the entire collection. This is the first of the two steps the history
 * page uses to populate its entity rail — the second is one `fetchVersionCount`
 * or `fetchEntityHistory` per id, against that entity's own path.
 *
 * Reads the current membership, so an entity that stopped being related during
 * the window will not appear. That is a known limit, not an oversight: there is
 * no way to ask the API which entities *were* related, since the only query
 * that spans time is the one that loses the filter.
 */
export async function fetchRelatedEntityIds(
  endpoint: string,
  parentPath: string,
  relation: string,
  set: string,
  headers: Record<string, string>,
  limit: number = MAX_LISTED_RELATIONS,
): Promise<{ total: number | null; items: Array<{ id: string; name: string }> } | null> {
  // `name` is selected only for the types that have one. Asking for it on
  // Observations or HistoricalLocations answers `404 Invalid field: name`,
  // which used to drop those relations from the rail entirely.
  const fields = hasNameField(set) ? '@iot.id,name' : '@iot.id'

  // `$count` comes back in the same request, so one read decides both what to
  // list and whether the relation is too large to list at all.
  const url =
    `${endpoint}/${parentPath}/${relation}` +
    `?$select=${fields}&$top=${limit}&$count=true`

  try {
    const response = await fetch(url, { headers, cache: 'no-store' })
    if (!response.ok) return null

    const payload = await response.json().catch(() => null)
    const body = payload as Record<string, unknown> | null

    // A to-one relation answers with the entity itself, not a `value` array.
    const rows = Array.isArray(body?.value)
      ? body.value
      : body?.['@iot.id'] != null
        ? [body]
        : null
    if (!rows) return null

    const items = rows
      .map((row) => row as Record<string, unknown>)
      .filter((row) => row?.['@iot.id'] != null)
      .map((row) => ({
        id: String(row['@iot.id']),
        name: typeof row.name === 'string' ? row.name : '',
      }))

    const count = body?.['@iot.count']
    return {
      total: typeof count === 'number' ? count : items.length,
      items,
    }
  } catch {
    return null
  }
}
