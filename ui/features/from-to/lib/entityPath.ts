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
 * @file features/from-to/lib/entityPath.ts
 *
 * Which URL to ask for an entity's history.
 *
 * A child entity can be addressed two ways, and only one of them answers
 * correctly under `$from_to`. Measured against a local istSOS4:
 *
 *   GET /Things(1)/Datastreams(1)?$from_to=<all time>   two rows, identical
 *   GET /Datastreams(1)?$from_to=<all time>             one row
 *
 * The nested form joins against the parent's `Thing_traveltime` rows, so every
 * version comes back once per parent version — Thing 1 has two versions, so
 * every datastream under it doubles. Reading a child through its parent is
 * therefore always wrong for history, and this module rewrites such a path to
 * the child's own.
 *
 * Child *collections* are worse, and cannot be rewritten at all. Measured on
 * the same instance, where Thing 1 owns one Location and the system holds five:
 *
 *   GET /Things(1)/Locations                       count 1,  ids [1]
 *   GET /Things(1)/Locations?$from_to=<all time>   count 5,  ids [1,2,3,4,5]
 *
 * Under `$from_to` the parent filter is *lost* on a many-to-many navigation and
 * the whole collection comes back. De-duplicating does not help: the extra rows
 * are other Things' locations, not copies. A one-to-many child keeps its filter
 * (`/Things(1)/Datastreams` stays ids [1,2,3,4,21]) and only doubles — but the
 * two cases are indistinguishable from the path alone, so no nested collection
 * is safe to read for history. `historyPath()` refuses them; the caller must
 * resolve the related ids *without* `$from_to`, then read each by its own path.
 */

/** One `Set(id)` step of an OData-style resource path. */
export type PathSegment = {
  /** The entity set, e.g. `Things`. */
  set: string
  /** The key, when this segment addresses one entity. */
  id: string | null
}

const SEGMENT_PATTERN = /^([A-Za-z][A-Za-z0-9_]*)(?:\(([^()]+)\))?$/

/** Renders one segment: `Things` or `Things(1)`. */
export function formatSegment(segment: PathSegment): string {
  return segment.id === null ? segment.set : `${segment.set}(${segment.id})`
}

/**
 * Reads a resource path into its segments.
 *
 * Returns `null` when any segment is not a bare entity set or a keyed one, so a
 * hand-edited URL cannot be turned into a request.
 */
export function parseEntityPath(path: string): PathSegment[] | null {
  const trimmed = String(path ?? '')
    .trim()
    .replace(/^\/+|\/+$/g, '')
  if (!trimmed) return null

  const segments: PathSegment[] = []

  for (const raw of trimmed.split('/')) {
    const match = SEGMENT_PATTERN.exec(raw)
    if (!match) return null
    const id = match[2] === undefined ? null : match[2].trim()
    if (id !== null && !id) return null
    segments.push({ set: match[1], id })
  }

  return segments
}

/**
 * The path to read this entity's history from, or `null` when there is none.
 *
 * When the last segment addresses a single entity, that segment alone is the
 * answer — dropping the parent is what avoids the duplicated rows. A top-level
 * collection (`Things`) is returned unchanged and is safe.
 *
 * A collection reached through a parent (`Things(1)/Locations`) returns `null`:
 * `$from_to` can silently drop the parent filter there and hand back the entire
 * collection, and nothing in the path says whether it will. Resolve the related
 * ids without `$from_to` first, then ask for each one's own path.
 */
export function historyPath(path: string): string | null {
  const segments = parseEntityPath(path)
  if (!segments || segments.length === 0) return null

  const last = segments[segments.length - 1]
  if (last.id !== null) return formatSegment(last)

  if (segments.length > 1) return null

  return formatSegment(last)
}

/**
 * True when the path reaches a collection through a parent — the shape whose
 * `$from_to` response cannot be trusted, in rows or in `$count`.
 */
export function isNestedCollection(path: string): boolean {
  const segments = parseEntityPath(path)
  if (!segments || segments.length < 2) return false
  return segments[segments.length - 1].id === null
}

/** The entity set a path addresses, e.g. `Datastreams`. */
export function entitySetOf(path: string): string | null {
  const segments = parseEntityPath(path)
  if (!segments || segments.length === 0) return null
  return segments[segments.length - 1].set
}

/** The key a path addresses, or `null` when it addresses a collection. */
export function entityIdOf(path: string): string | null {
  const segments = parseEntityPath(path)
  if (!segments || segments.length === 0) return null
  return segments[segments.length - 1].id
}
