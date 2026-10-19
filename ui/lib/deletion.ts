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
 * @file lib/deletion.ts
 *
 * The one rule both time-travel features use to decide that an entity was
 * deleted, when, and by which commit — so As-Of and From-To can never disagree.
 *
 * A deletion reaches the history in one of two ways:
 *
 * - **Recorded.** Since istSOS4 `d617df3` a delete writes a row of its own: the
 *   entity's last state, in force for a single instant (`[T, T]`, both ends
 *   included), carrying the DELETE commit. `$from_to` returns it, printed as a
 *   bare timestamp with no `/`; `$as_of` never does. When, who and why all come
 *   from that row.
 * - **Inferred.** Before that commit the same row was written with an empty
 *   range, which no query returns, so the deletion can only be deduced from the
 *   last version ending with nothing after it. A bulk delete, a row removed by a
 *   cascade, and any delete on a deployment with authorization off still look
 *   like this — as does every deletion made before the upgrade.
 */

import type { Validity } from '@/lib/systemTimeValidity'

/** The commit fields a deletion reads; both features' commit types fit it. */
export type DeletionCommit = {
  '@iot.id'?: number | string
  date?: string
  author?: string
  message?: string
  actionType?: string
}

/** How an entity's history ends, when it ends in a deletion. */
export type Deletion = {
  /**
   * When the entity stopped existing, as the API prints it: whole seconds, and
   * the exclusive end of its last version.
   */
  at: string
  /** True when the history holds the deletion itself; false when deduced. */
  recorded: boolean
  /** The DELETE commit. Only a recorded deletion has one. */
  commit: DeletionCommit | null
}

/** One row of an entity's history, as far as deletion is concerned. */
export type HistoryRow = {
  validity: Validity
  commit: DeletionCommit | null
}

/**
 * True for the row a delete writes.
 *
 * Zero length alone does not identify it. `degenerate` is also set for a
 * version replaced within the second it was written, whose bounds print alike,
 * and the trigger writes `[T, T]` for a row created and removed inside one
 * transaction. Only the delete's own row carries the DELETE commit.
 */
export function isDeletionRecord(row: HistoryRow): boolean {
  return (
    row.validity.degenerate &&
    String(row.commit?.actionType ?? '').toUpperCase() === 'DELETE'
  )
}

/**
 * Splits one entity's history into the versions it had and how it ended.
 *
 * `rows` must be oldest first. `complete` says whether they hold the entity's
 * newest row and reach the present: only then can a closed last version be
 * read as a deletion, since a window ending in the past, or a history cut off
 * at a page boundary, closes the last version of a live entity too. A recorded
 * deletion needs no such care: the row says what happened.
 */
export function resolveDeletion<R extends HistoryRow>(
  rows: R[],
  complete: boolean,
): { versions: R[]; deletion: Deletion | null } {
  const versions = rows.filter((row) => !isDeletionRecord(row))

  // An id is never reused, so there is at most one; the newest wins anyway.
  const record = rows.filter(isDeletionRecord).pop()
  if (record) {
    return {
      versions,
      deletion: { at: record.validity.start, recorded: true, commit: record.commit },
    }
  }

  const newest = versions[versions.length - 1]
  if (complete && newest?.validity.end) {
    return {
      versions,
      deletion: { at: newest.validity.end, recorded: false, commit: null },
    }
  }

  return { versions, deletion: null }
}
