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
 * @file features/from-to/lib/versionRows.ts
 *
 * Turns a raw `$from_to` response into the version list the UI reads.
 *
 * Two things the response does not guarantee on its own:
 *
 * **Rows can repeat.** Reading a child collection through its parent duplicates
 * every row once per parent version. Measured against a local istSOS4:
 * `GET /Things(1)/Datastreams?$from_to=1970-01-01T00:00:00Z/2099-01-01T00:00:00Z`
 * answers ten rows for five datastreams — ids 1,1,2,2,3,3,4,4,21,21 — because
 * the nested path joins against `Thing_traveltime` and Thing 1 has two
 * versions. `$count=true` on that same request is *correct* (5), since counting
 * is over distinct `(id, systemTimeValidity)` pairs, so counts and rows
 * disagree. The duplicates are identical, so collapsing on that same pair
 * restores the right answer. See `entityPath.ts` for the other half of the fix.
 *
 * **Order is the API's, not a guarantee.** Rows arrive ordered by
 * `(id, systemTimeValidity ASC)`, but the timeline depends on it, so it is
 * re-established here rather than taken on trust.
 *
 * Rows whose validity cannot be read are dropped — see `parseValidity`.
 */

import {
  parseValidity,
  type Validity,
} from '@/lib/systemTimeValidity'

/** A commit as `$expand=Commit` returns it (`date`, not `authoredAt`). */
export type VersionCommit = {
  '@iot.id'?: number
  date?: string
  author?: string
  message?: string
  actionType?: string
  encodingType?: string
}

/** One element of `value[]`, before it has been read. */
export type RawVersionRow = Record<string, unknown>

/** One version of one entity, ready to render. */
export type EntityVersion = {
  /** `@iot.id` of the entity this version belongs to. */
  id: string
  /** The period this version was in force. */
  validity: Validity
  /** The commit that produced it, when `$expand=Commit` was asked for. */
  commit: VersionCommit | null
  /** The entity's fields as they stood, with API metadata removed. */
  body: Record<string, unknown>
  /** The untouched response row, for the raw-JSON view. */
  raw: RawVersionRow
}

/**
 * Response keys that describe the response rather than the entity.
 *
 * Everything else in a row is a field of the entity at that version and belongs
 * in the diff. Navigation links are matched by suffix because their names carry
 * the related entity (`Datastreams@iot.navigationLink`).
 */
const NAVIGATION_LINK_SUFFIX = '@iot.navigationLink'
const METADATA_KEYS = new Set([
  '@iot.id',
  '@iot.selfLink',
  'systemTimeValidity',
  'Commit',
])

function isMetadataKey(key: string): boolean {
  return METADATA_KEYS.has(key) || key.endsWith(NAVIGATION_LINK_SUFFIX)
}

/** The entity's own fields, with the response's own bookkeeping removed. */
export function extractBody(row: RawVersionRow): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  for (const key of Object.keys(row)) {
    if (!isMetadataKey(key)) body[key] = row[key]
  }
  return body
}

function readCommit(row: RawVersionRow): VersionCommit | null {
  const commit = row.Commit
  if (!commit || typeof commit !== 'object' || Array.isArray(commit)) return null
  const typed = commit as VersionCommit
  return typed['@iot.id'] == null ? null : typed
}

/**
 * Reads `value[]` into versions: metadata split from body, duplicates removed,
 * ordered oldest to newest.
 */
export function readVersions(rows: unknown): EntityVersion[] {
  if (!Array.isArray(rows)) return []

  const versions: EntityVersion[] = []

  for (const candidate of rows) {
    if (!candidate || typeof candidate !== 'object') continue
    const row = candidate as RawVersionRow

    const validity = parseValidity(row.systemTimeValidity)
    if (!validity) continue

    versions.push({
      id: String(row['@iot.id'] ?? ''),
      validity,
      commit: readCommit(row),
      body: extractBody(row),
      raw: row,
    })
  }

  return sortVersions(dedupeVersions(versions))
}

/**
 * Collapses rows the nested path duplicated.
 *
 * Identity is `(id, validity, commit)`. The commit is not decoration: the API
 * prints `systemTimeValidity` at **whole-second precision** while storing it at
 * microsecond precision, so edits made inside the same second are reported with
 * identical validity strings. Measured against a local istSOS4 — 120 rapid
 * edits to one Thing came back as 120 rows carrying only **four** distinct
 * validity strings, 76 of them sharing `06:29:00Z/06:29:00Z`. Keying on
 * validity alone therefore discarded real versions, which is the opposite of
 * what this function is for.
 *
 * Each version carries its own commit, and those stay distinct (120 rows, 120
 * commit ids), so the commit is what separates versions the printed timestamp
 * cannot. A genuine duplicate from a nested path repeats the same row, commit
 * included, so it still collapses.
 *
 * A row with no commit falls back to validity alone — the same behaviour as
 * before, which is the best available when `$expand=Commit` was not asked for.
 */
export function dedupeVersions(versions: EntityVersion[]): EntityVersion[] {
  const seen = new Set<string>()
  const unique: EntityVersion[] = []

  for (const version of versions) {
    const key = versionKey(version)
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(version)
  }

  return unique
}

/**
 * A version's identity: entity, validity and the commit that wrote it.
 *
 * The validity alone is not one — rapid edits share the printed second (see
 * dedupeVersions) — so anything that must tell versions apart, a React key
 * included, uses this. Every list `readVersions` returns has been deduplicated
 * on exactly this key, so within one list it is unique by construction.
 */
export function versionKey(version: EntityVersion): string {
  return [
    version.id,
    version.validity.start,
    version.validity.end ?? '',
    version.commit?.['@iot.id'] ?? '',
  ].join('|')
}

/**
 * Oldest first, then by entity id so a collection response stays grouped.
 *
 * Versions written inside the same second are reported with identical start
 * instants, so the timestamp alone cannot order them. Commit ids are issued in
 * order, so they break those ties and keep a burst of rapid edits in the
 * sequence they actually happened.
 */
export function sortVersions(versions: EntityVersion[]): EntityVersion[] {
  return [...versions].sort((a, b) => {
    if (a.id !== b.id) return a.id.localeCompare(b.id, undefined, { numeric: true })

    const byStart = Date.parse(a.validity.start) - Date.parse(b.validity.start)
    if (byStart !== 0) return byStart

    return Number(a.commit?.['@iot.id'] ?? 0) - Number(b.commit?.['@iot.id'] ?? 0)
  })
}

/**
 * Whether the entity no longer exists, as far as this window can tell.
 *
 * A deletion leaves no readable version of its own: the row carrying the DELETE
 * commit is written with an empty range, which never satisfies the `&&` that
 * `$from_to` compiles to. Verified by driving the triggers against a local
 * istSOS4 — a deleted Thing returns exactly one row, closed, and carrying the
 * commit *before* the delete.
 *
 * What is left is structural: an edit always leaves a successor still in force,
 * a deletion leaves none. So a newest version with a closed end means the
 * entity is gone — but only if the window reaches the present, since a window
 * that ends in the past closes the last version for an ordinary entity too.
 */
export function looksDeleted(
  versions: EntityVersion[],
  windowEndsAtPresent: boolean,
  /**
   * True when the window holds more versions than were fetched. The inference
   * rests entirely on holding the *newest* version, so a truncated history
   * cannot support it: reading the oldest 100 of 120 leaves a closed-ended last
   * row for a perfectly live entity, which reported a busy station as deleted.
   */
  truncated = false,
): boolean {
  if (truncated || !windowEndsAtPresent || versions.length === 0) return false
  const newest = versions[versions.length - 1]
  return newest.validity.end !== null
}
