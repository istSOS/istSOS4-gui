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
 * @file features/from-to/lib/systemTimeValidity.ts
 *
 * The one reader of a version's `systemTimeValidity`.
 *
 * A `$from_to` row reports the period the version was in force as a single
 * string. Measured against a local istSOS4:
 *
 *   "2026-08-22T09:28:53Z/2026-08-22T09:37:40Z"   a superseded version
 *   "2026-08-22T09:37:40Z/infinity"               the version still in force
 *
 * Two shapes are *not* the obvious ones and are why this lives in one place:
 *
 * 1. A bare timestamp with no `/`. `visitors.py` formats the column that way
 *    when the range's bounds are equal, i.e. a version that was in force for
 *    zero time. Splitting on `/` and taking `[1]` yields `undefined` there,
 *    which reads as "no upper bound" — the exact opposite of the truth. Such a
 *    version must never be shown as current, so it is returned with
 *    `start === end` and `degenerate: true` rather than as open-ended.
 *
 * 2. `null`, or the literal `"empty"`. An empty Postgres range has NULL bounds,
 *    so `to_char()` yields NULL and the field arrives as JSON null. This is not
 *    hypothetical: deleting an entity writes exactly such a row (the DELETE
 *    branch of `istsos_mutate_history()` closes the range at its own lower
 *    bound). Those rows are unreachable through `$from_to` — the range never
 *    satisfies `&&` — but a caller reading the history tables by another path
 *    can meet one, and it is not a version anyone can display.
 *
 * Anything unparseable returns `null` so a single malformed row cannot take a
 * timeline down with it.
 */

/** A version's validity period, as reported by the API. */
export type Validity = {
  /** ISO instant the version came into force. */
  start: string
  /** ISO instant it was superseded, or `null` while it is still in force. */
  end: string | null
  /**
   * True when the version was in force for zero time — a bare timestamp with
   * no `/`. `start` and `end` are equal; it is closed, not open-ended.
   */
  degenerate: boolean
}

/** Postgres prints an empty range as this literal. */
const EMPTY_RANGE = 'empty'

/** The API writes an unbounded upper end as this literal, not as a timestamp. */
const INFINITY = 'infinity'

function isInstant(value: string): boolean {
  return value.length > 0 && Number.isFinite(Date.parse(value))
}

/**
 * Reads a `systemTimeValidity` value into its two ends.
 *
 * Returns `null` when the value is absent, empty, or not a period this UI can
 * place on a timeline.
 */
export function parseValidity(value: unknown): Validity | null {
  if (typeof value !== 'string') return null

  const raw = value.trim()
  if (!raw || raw.toLowerCase() === EMPTY_RANGE) return null

  const separator = raw.indexOf('/')

  // Shape 1: a bare timestamp — a version that was in force for zero time.
  // Closed at the instant it opened, never open-ended.
  if (separator === -1) {
    if (!isInstant(raw)) return null
    return { start: raw, end: raw, degenerate: true }
  }

  const start = raw.slice(0, separator).trim()
  const end = raw.slice(separator + 1).trim()

  if (!isInstant(start)) return null

  // Shape 2: still in force.
  if (!end || end.toLowerCase() === INFINITY) {
    return { start, end: null, degenerate: false }
  }

  // A closed period whose end we cannot read is more usefully treated as
  // unparseable than as open — showing a superseded version as current is the
  // failure this module exists to prevent.
  if (!isInstant(end)) return null

  return { start, end, degenerate: start === end }
}

/** True when this version is the one currently in force. */
export function isOpenEnded(validity: Validity): boolean {
  return validity.end === null
}

/**
 * How long the version has been in force, in milliseconds.
 *
 * A closed version is measured between its own two ends. An open-ended one is
 * measured to `asOf` — normally the end of the window being viewed, so the
 * number does not drift between renders — but never past now: a version cannot
 * have been in force in the future. Without that ceiling a window ending at the
 * far-future sentinel (`2099-01-01`, which is what "all recorded history"
 * sends) reports the current version as having been held for 26,000 days, and
 * sizes its timeline band to match.
 */
export function validityDurationMs(
  validity: Validity,
  asOf: string | number,
): number {
  const from = Date.parse(validity.start)

  const ceiling = Math.min(Number(new Date(asOf)), Date.now())
  const to = validity.end === null ? ceiling : Date.parse(validity.end)

  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0
  return Math.max(to - from, 0)
}
