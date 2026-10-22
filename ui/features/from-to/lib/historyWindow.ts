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
 * @file features/from-to/lib/historyWindow.ts
 *
 * The interval a history page is looking at, and the rules for building one the
 * API will accept.
 *
 * `$from_to` answers every misuse with `500 Internal server error` and a body
 * that says nothing more — the real messages are raised in `sta2rest.py` and
 * never reach the client. So each rule below has to be enforced here, before a
 * request is sent, rather than reported afterwards. Measured against a local
 * istSOS4:
 *
 *   $from_to=<later>/<earlier>   -> 500   "value1 cannot be greater than value2"
 *   $from_to=<start>             -> 500   "missing end datetime"
 *   $from_to=…/2030-01-01…       -> 200   future ends are fine, unlike $as_of
 *   $from_to=2026-08-22T00:00:00 -> 200   but read in the *server's* timezone
 *
 * The last one is why every bound is serialised as explicit UTC: a naive
 * datetime is accepted, then interpreted wherever the API happens to run, so
 * the same string means different instants on different deployments.
 */

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)

/** The transaction-time interval a history page is reading. */
export type HistoryWindow = {
  /** ISO instant, UTC, inclusive. */
  from: string
  /** ISO instant, UTC. Versions overlapping the interval are returned. */
  to: string
}

/** Why a window cannot be used, in words a person can act on. */
export type WindowProblem =
  | { field: 'from' | 'to'; reason: 'missing' }
  | { field: 'from' | 'to'; reason: 'unreadable' }
  | { field: 'from'; reason: 'after-to' }

/**
 * A window wide enough to contain every version ever written.
 *
 * Constant rather than "now" so responses stay cacheable, and legal because
 * `$from_to` puts no ceiling on its upper bound.
 */
export const FULL_HISTORY_WINDOW: HistoryWindow = {
  from: '1970-01-01T00:00:00Z',
  to: '2099-01-01T00:00:00Z',
}

/** Serialises one bound as whole-second UTC, the form the API reads reliably. */
export function toUtcInstant(value: string | number | Date): string | null {
  const parsed = dayjs.utc(value)
  if (!parsed.isValid()) return null
  return parsed.startOf('second').toISOString().replace('.000Z', 'Z')
}

/**
 * Checks a window against every rule the API enforces with a 500.
 *
 * Returns the problems in field order so a form can mark the first offending
 * input. An empty array means the window is safe to send.
 */
export function validateWindow(
  window: Partial<HistoryWindow> | null | undefined,
): WindowProblem[] {
  const problems: WindowProblem[] = []

  const from = (window?.from ?? '').trim()
  const to = (window?.to ?? '').trim()

  if (!from) problems.push({ field: 'from', reason: 'missing' })
  else if (!dayjs.utc(from).isValid()) {
    problems.push({ field: 'from', reason: 'unreadable' })
  }

  if (!to) problems.push({ field: 'to', reason: 'missing' })
  else if (!dayjs.utc(to).isValid()) {
    problems.push({ field: 'to', reason: 'unreadable' })
  }

  // Only meaningful once both ends are readable.
  if (problems.length === 0 && dayjs.utc(from).isAfter(dayjs.utc(to))) {
    problems.push({ field: 'from', reason: 'after-to' })
  }

  return problems
}

/** True when the window is safe to send. */
export function isWindowUsable(
  window: Partial<HistoryWindow> | null | undefined,
): boolean {
  return validateWindow(window).length === 0
}

/**
 * The `$from_to` parameter value for a window, or `null` when it breaks a rule.
 *
 * The separator is `/`. A comma appears in some of the tutorial notebooks and
 * is *not* accepted by the parser.
 */
export function formatWindow(
  window: Partial<HistoryWindow> | null | undefined,
): string | null {
  if (!isWindowUsable(window)) return null
  const from = toUtcInstant(window!.from!)
  const to = toUtcInstant(window!.to!)
  if (!from || !to) return null
  return `${from}/${to}`
}

/** Reads a `<from>/<to>` value back into a window. */
export function parseWindow(value: unknown): HistoryWindow | null {
  if (typeof value !== 'string') return null
  const separator = value.indexOf('/')
  if (separator === -1) return null

  const from = toUtcInstant(value.slice(0, separator).trim())
  const to = toUtcInstant(value.slice(separator + 1).trim())
  if (!from || !to) return null

  const window = { from, to }
  return isWindowUsable(window) ? window : null
}

/**
 * Whether the window reaches the present.
 *
 * Deletion can only be inferred inside a window that does — a window ending in
 * the past closes the newest version of a perfectly ordinary entity too. See
 * `looksDeleted`.
 */
export function reachesPresent(
  window: HistoryWindow,
  now: string | number | Date = Date.now(),
): boolean {
  return !dayjs.utc(window.to).isBefore(dayjs.utc(now))
}

/**
 * The window a history page should open on: the entity's own lifetime.
 *
 * Opening on a fixed "last 30 days" shows an empty page whenever the entity was
 * last touched before that — which on demo data is most of them. Fitting to the
 * versions already in hand means the page always opens on something, and the
 * user narrows from there.
 *
 * `starts` are version start instants; `padMs` widens both ends slightly so the
 * first and last bands are not flush against the edge.
 */
export function fitWindowToVersions(
  starts: string[],
  now: string | number | Date = Date.now(),
  padMs = 60 * 60 * 1000,
): HistoryWindow | null {
  const instants = starts
    .map((start) => dayjs.utc(start))
    .filter((parsed) => parsed.isValid())
    .map((parsed) => parsed.valueOf())

  if (instants.length === 0) return null

  const earliest = Math.min(...instants)
  const from = toUtcInstant(earliest - padMs)
  const to = toUtcInstant(Number(new Date(now)) + padMs)
  if (!from || !to) return null

  return { from, to }
}
