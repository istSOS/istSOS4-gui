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
 * @file features/as-of/lib/existenceBounds.ts
 *
 * Safe `$as_of` instants for the edges of a Thing's lifetime.
 *
 * The backend stores `systemTimeValidity` with microsecond precision but both
 * prints timestamps and parses `$as_of` at whole-second precision. A version
 * that began at `09:28:53.056Z` is therefore reported as starting at
 * `09:28:53Z`, yet asking for that instant answers 404 — the request resolves
 * to `09:28:53.000Z`, which is 56 ms before the row existed. Measured against a
 * local istSOS4 for a Thing created at `09:28:53.056Z`:
 *
 *   $as_of=2026-08-22T09:28:53Z -> 404
 *   $as_of=2026-08-22T09:28:54Z -> 200
 *
 * So a UI control that navigates to "the moment this was created" cannot use
 * the reported timestamp directly; it has to land on the next whole second.
 * The same reasoning mirrored applies to the end of a version, whose validity
 * range is half-open — the reported end instant is already outside it.
 *
 * Both helpers move by a whole second rather than a millisecond because
 * sub-second precision is discarded on the way in.
 */

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)

/**
 * The earliest `$as_of` that is guaranteed to see a version starting at
 * `createdAt` — the first whole second at or after it.
 */
export function firstValidAsOf(createdAt: string | null): string | null {
  if (!createdAt) return null
  const parsed = dayjs.utc(createdAt)
  if (!parsed.isValid()) return null
  return parsed.startOf('second').add(1, 'second').toISOString()
}

/**
 * The latest `$as_of` that is guaranteed to still see a version ending at
 * `deletedAt` — the last whole second strictly before it.
 *
 * `deletedAt` is the exclusive upper bound of the validity range, so the
 * reported instant itself already falls outside the version.
 */
export function lastValidAsOf(deletedAt: string | null): string | null {
  if (!deletedAt) return null
  const parsed = dayjs.utc(deletedAt)
  if (!parsed.isValid()) return null
  return parsed.startOf('second').subtract(1, 'second').toISOString()
}
