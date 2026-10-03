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

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)

/** Width of the default observation window, in days, ending at its anchor. */
export const OBSERVATION_WINDOW_DAYS = 7

export type ObservationWindow = {
  startIso: string
  endIso: string
}

/** The 7 days ending at `anchor` — the one shape every default window has. */
export function getWindowEndingAt(anchor: string): ObservationWindow {
  const end = dayjs.utc(anchor)
  const resolvedEnd = end.isValid() ? end : dayjs.utc()
  return {
    startIso: resolvedEnd.subtract(OBSERVATION_WINDOW_DAYS, 'day').toISOString(),
    endIso: resolvedEnd.toISOString(),
  }
}

/**
 * Live-mode default window: the 7 days ending at the datastream's last
 * measurement, read from its `phenomenonTime` extent ("isoStart/isoEnd").
 * Falls back to "now" when the extent is missing or unparseable.
 */
export function getLiveDefaultWindow(
  phenomenonTime?: string | null
): ObservationWindow {
  const [, endRaw] = String(phenomenonTime ?? '').split('/')
  return getWindowEndingAt(endRaw || dayjs.utc().toISOString())
}
