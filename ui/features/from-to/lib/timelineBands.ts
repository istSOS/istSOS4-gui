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
 * @file features/from-to/lib/timelineBands.ts
 *
 * How wide each version's band is on the timeline.
 *
 * Version lifetimes are wildly uneven. On a local istSOS4, Thing 1's first
 * version was in force for eight minutes and its second for seven days — at
 * true scale the first is a hairline nobody can click, and a correction made
 * seconds after a mistake is exactly the edit a reader is looking for.
 *
 * So bands are proportional but floored: anything below `minPercent` is raised
 * to it, and the width that costs is taken from the bands above the floor in
 * proportion to how far above it they are. Wide bands give up a little, narrow
 * ones stay reachable, and the ordering by duration is preserved everywhere it
 * still fits. The true duration is printed on each band, so the floor never
 * misleads about how long a version actually lasted.
 *
 * When the floor cannot be honoured — more versions than `100 / minPercent` —
 * every band takes an equal share instead, which is the honest answer once
 * proportionality has stopped being expressible.
 */

import {
  validityDurationMs,
  type Validity,
} from '@/lib/systemTimeValidity'

/** Default floor, in percent. Eight versions fit before it gives way. */
export const DEFAULT_MIN_PERCENT = 12

function equalShares(count: number): number[] {
  return new Array(count).fill(100 / count)
}

/**
 * Normalises to sum exactly 100, absorbing floating-point drift into the
 * widest band so no row ever overflows or leaves a sliver.
 */
function normalise(widths: number[]): number[] {
  const total = widths.reduce((sum, width) => sum + width, 0)
  if (total <= 0) return equalShares(widths.length)

  const scaled = widths.map((width) => (width / total) * 100)

  let widestIndex = 0
  for (let i = 1; i < scaled.length; i += 1) {
    if (scaled[i] > scaled[widestIndex]) widestIndex = i
  }

  const drift = 100 - scaled.reduce((sum, width) => sum + width, 0)
  scaled[widestIndex] += drift

  return scaled
}

/**
 * Band widths, in percent, summing to 100.
 *
 * `durations` are in milliseconds and must be in the order the bands render.
 * Non-finite or negative durations are treated as zero, so one unreadable row
 * cannot collapse the timeline.
 */
export function computeBandWidths(
  durations: number[],
  minPercent: number = DEFAULT_MIN_PERCENT,
): number[] {
  const count = durations.length
  if (count === 0) return []
  if (count === 1) return [100]

  const floor = Math.max(0, minPercent)

  // More bands than the floor can accommodate: proportionality is no longer
  // expressible, so share the row equally rather than pretend.
  if (floor > 0 && count * floor >= 100) return equalShares(count)

  const safe = durations.map((duration) =>
    Number.isFinite(duration) && duration > 0 ? duration : 0,
  )
  const total = safe.reduce((sum, duration) => sum + duration, 0)
  if (total <= 0) return equalShares(count)

  const proportional = safe.map((duration) => (duration / total) * 100)

  const deficit = proportional.reduce(
    (sum, width) => sum + Math.max(0, floor - width),
    0,
  )
  const surplus = proportional.reduce(
    (sum, width) => sum + Math.max(0, width - floor),
    0,
  )

  if (deficit === 0 || surplus === 0) return normalise(proportional)

  const adjusted = proportional.map((width) => {
    if (width <= floor) return floor
    // Pay for the floor in proportion to how far above it this band sits.
    return width - ((width - floor) / surplus) * deficit
  })

  return normalise(adjusted)
}

/**
 * Band widths for a list of versions, measuring open-ended ones to `windowEnd`.
 *
 * Pass the end of the window being viewed rather than "now", so widths do not
 * drift between renders.
 */
export function computeBands(
  validities: Validity[],
  windowEnd: string | number,
  minPercent: number = DEFAULT_MIN_PERCENT,
): number[] {
  return computeBandWidths(
    validities.map((validity) => validityDurationMs(validity, windowEnd)),
    minPercent,
  )
}

/**
 * A duration in the shortest unit that still reads precisely — seconds below a
 * minute, minutes below an hour, hours below two days, then days.
 *
 * The seconds tier is not cosmetic. Corrections arrive in bursts: a rename
 * followed seconds later by a fix, or a quality-flagging run reapplied twice.
 * Rounding those to minutes prints "held 0 min", which reads as "no time at
 * all" for a version that genuinely existed and is genuinely readable — and
 * short-lived versions are precisely the ones the width floor exists to keep
 * clickable.
 */
export function formatDuration(durationMs: number): string {
  // Zero does not mean "no time": the API prints validity at whole-second
  // precision, so any version replaced inside the same second it was written
  // measures as zero here. It existed — we just cannot say for how long, and
  // "0 s" would claim more precision than the data carries.
  if (!Number.isFinite(durationMs) || durationMs <= 0) return '< 1 s'

  const seconds = durationMs / 1000
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} s`

  const minutes = seconds / 60
  if (minutes < 60) return `${Math.round(minutes)} min`

  const hours = minutes / 60
  if (hours < 48) return `${hours < 10 ? hours.toFixed(1) : Math.round(hours)} h`

  return `${Math.round(hours / 24)} days`
}
