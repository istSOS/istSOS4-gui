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

import {
  OBSERVATION_WINDOW_DAYS,
  getWindowEndingAt,
  type ObservationWindow,
} from '@/features/observations/lib/observationWindow'

/** Width of the snapshot observation window, in days, ending at the as-of date. */
export const SNAPSHOT_WINDOW_DAYS = OBSERVATION_WINDOW_DAYS

/**
 * The one definition of a snapshot's default observation window:
 * [asOfDate-7d, asOfDate].
 *
 * This is a *default anchor*, not a hard bound. In As-Of mode the chart opens
 * on this window because it is the slice of time the snapshot is about — but
 * when it holds no observations the chart falls back to the live-mode window
 * (the 7 days ending at the last measurement that existed at the snapshot),
 * and the user stays free to pick any range from the date picker, exactly as
 * in live mode. Every fetch keeps sending `$as_of`, so whatever window is shown
 * is still the data as it existed at that point in time.
 */
export function getSnapshotWindow(asOfDate: string): ObservationWindow {
  return getWindowEndingAt(asOfDate)
}
