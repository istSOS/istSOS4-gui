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
 * @file features/from-to/lib/diffVersions.ts
 *
 * What changed between two versions of one entity.
 *
 * Every version's whole body arrives in the same `$from_to` response, so
 * comparing any two is a local walk — there is no request per pair, and the
 * pane can update while a selection is dragged.
 *
 * Nested objects are walked into and addressed by dotted path
 * (`unitOfMeasurement.symbol`), which is what makes a unit correction read as
 * one changed field rather than a replaced object. Arrays are *not* walked:
 * `observedArea.coordinates` is one leaf, because a polygon whose points
 * shifted is one edit to a reader, not forty changes to
 * `coordinates.0.0.0`. The same reasoning keeps geometry legible until it earns
 * a map of its own.
 */

/** How a field differs between the two versions being compared. */
export type ChangeKind = 'modified' | 'added' | 'removed' | 'unchanged'

/** One field, at one dotted path, across two versions. */
export type FieldChange = {
  /** Dotted path, e.g. `properties.battery`. */
  path: string
  /** Value in the base version, or `null` when the field was absent. */
  from: unknown
  /** Value in the compared version, or `null` when the field was absent. */
  to: unknown
  kind: ChangeKind
}

/** Changed fields sharing a top-level key, for a collapsible group. */
export type ChangeGroup = {
  /** Top-level key, or `CORE_FIELDS_GROUP` for fields with no parent. */
  key: string
  changes: FieldChange[]
  /** How many of `changes` actually differ. */
  changedCount: number
}

/** Group key for top-level fields such as `name` and `description`. */
export const CORE_FIELDS_GROUP = 'Core fields'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) !== Date.prototype
  )
}

/**
 * Flattens an entity body to dotted paths.
 *
 * Objects are walked into; arrays and scalars are leaves. An object with no
 * keys is itself a leaf, so `properties: {}` stays visible as a field rather
 * than vanishing from the diff.
 */
export function flattenBody(
  body: Record<string, unknown>,
  prefix = '',
  out: Record<string, unknown> = {},
): Record<string, unknown> {
  for (const key of Object.keys(body)) {
    const value = body[key]
    const path = prefix ? `${prefix}.${key}` : key

    if (isPlainObject(value) && Object.keys(value).length > 0) {
      flattenBody(value, path, out)
    } else {
      out[path] = value
    }
  }
  return out
}

/** A stable string for comparing two leaf values. */
function serialise(value: unknown): string {
  if (value === null) return '\0null'
  if (value === undefined) return '\0undefined'
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

/** A leaf value as the diff should show it. Absent fields render as a dash. */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

/**
 * Compares two version bodies field by field.
 *
 * Returns every field in either version — including unchanged ones, so the
 * "show unchanged" toggle needs no second pass — ordered with the base
 * version's fields first and any fields only the compared version has after
 * them, so a diff reads in the order the entity is written.
 */
export function diffVersions(
  base: Record<string, unknown>,
  compared: Record<string, unknown>,
): FieldChange[] {
  const flatBase = flattenBody(base ?? {})
  const flatCompared = flattenBody(compared ?? {})

  const paths: string[] = Object.keys(flatBase)
  for (const path of Object.keys(flatCompared)) {
    if (!Object.prototype.hasOwnProperty.call(flatBase, path)) paths.push(path)
  }

  return paths.map((path) => {
    const inBase = Object.prototype.hasOwnProperty.call(flatBase, path)
    const inCompared = Object.prototype.hasOwnProperty.call(flatCompared, path)
    const from = inBase ? flatBase[path] : null
    const to = inCompared ? flatCompared[path] : null

    let kind: ChangeKind = 'unchanged'
    if (inBase && !inCompared) kind = 'removed'
    else if (!inBase && inCompared) kind = 'added'
    else if (serialise(from) !== serialise(to)) kind = 'modified'

    return { path, from, to, kind }
  })
}

/** Only the fields that differ. */
export function changedOnly(changes: FieldChange[]): FieldChange[] {
  return changes.filter((change) => change.kind !== 'unchanged')
}

/** Narrows to fields whose path contains `query`, case-insensitively. */
export function filterByPath(
  changes: FieldChange[],
  query: string,
): FieldChange[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return changes
  return changes.filter((change) => change.path.toLowerCase().includes(needle))
}

/**
 * Buckets changes by their top-level key, preserving first-seen order.
 *
 * Top-level scalars share one group so a two-field entity does not become two
 * single-row sections.
 */
export function groupChanges(changes: FieldChange[]): ChangeGroup[] {
  const order: string[] = []
  const buckets = new Map<string, FieldChange[]>()

  for (const change of changes) {
    const dot = change.path.indexOf('.')
    const key = dot === -1 ? CORE_FIELDS_GROUP : change.path.slice(0, dot)

    const bucket = buckets.get(key)
    if (bucket) {
      bucket.push(change)
    } else {
      buckets.set(key, [change])
      order.push(key)
    }
  }

  return order.map((key) => {
    const groupChangeList = buckets.get(key) ?? []
    return {
      key,
      changes: groupChangeList,
      changedCount: groupChangeList.filter((c) => c.kind !== 'unchanged').length,
    }
  })
}
