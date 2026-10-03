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

import { useEffect, useMemo, useState } from 'react'

import type { Thing } from '@/types/domain'
import { activeAdapter } from '../adapters/asOfAdapter'

/** Trailing delay before a new instant is fetched, so scrubber drags coalesce. */
const RESOLVE_DELAY_MS = 250

export type AsOfMapThingsResult = {
  /**
   * The Things the map, the panel selection and the chart pickers all work
   * from: the live list in live mode, the snapshot list in snapshot mode.
   */
  things: Thing[]
  /**
   * The instant `things` belongs to — null in live mode. It lags `asOfDate`
   * while a new instant loads; consumers that must not act on the previous
   * instant's Things wait until the two are equal.
   */
  resolvedFor: string | null
  isLoading: boolean
  /** Set when the whole snapshot failed; `things` is then the LIVE list. */
  error: string | null
  /** Data sources shown live because their snapshot could not be read. */
  failedEndpoints: string[]
  /** Data sources drawn as of the instant, but without their latest readings. */
  readingsUnavailableEndpoints: string[]
  /** Things drawn at a position that is not known to be historical. */
  approximateCount: number
  /** Things that existed at the instant but cannot be drawn: place not recorded. */
  lostCount: number
}

type Resolution = {
  asOf: string
  things: Thing[]
  failedEndpoints: string[]
  readingsUnavailableEndpoints: string[]
  error: string | null
}

/**
 * The Things as they existed at `asOfDate` — the map's side of a snapshot.
 *
 * Deliberately NOT the live list filtered: a Thing deleted since is absent
 * from that list, so it could never reappear on a snapshot from before its
 * deletion. The snapshot list is read in full, per data source.
 *
 * Before the first snapshot of a session resolves the list is EMPTY rather
 * than live: live positions under a snapshot label are exactly the bug this
 * exists to fix. Moving between instants keeps the previous snapshot on screen
 * until the next one arrives, so scrubbing does not blank the map.
 */
export function useAsOfMapThings({
  liveThings,
  asOfDate,
}: {
  liveThings: Thing[]
  asOfDate: string | null
}): AsOfMapThingsResult {
  const [resolution, setResolution] = useState<Resolution | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!asOfDate) {
      // Leaving snapshot mode drops the snapshot entirely; re-entering later
      // must never flash a stale instant.
      setResolution(null)
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)

    const timer = setTimeout(() => {
      activeAdapter
        .resolveMapThings(liveThings, asOfDate)
        .then((snapshot) => {
          if (cancelled) return
          setResolution({
            asOf: asOfDate,
            things: snapshot.things,
            failedEndpoints: snapshot.failedEndpoints,
            readingsUnavailableEndpoints: snapshot.readingsUnavailableEndpoints,
            error: null,
          })
        })
        .catch((err) => {
          if (cancelled) return
          console.error('[useAsOfMapThings] Error resolving map snapshot:', err)
          // Live data, flagged as such — the map says so rather than showing
          // an empty map, which would claim nothing existed.
          setResolution({
            asOf: asOfDate,
            things: liveThings.map((thing) => ({
              ...thing,
              __asOfLocationSource: 'live' as const,
            })),
            failedEndpoints: [],
            readingsUnavailableEndpoints: [],
            error: err instanceof Error ? err.message : String(err),
          })
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false)
        })
    }, RESOLVE_DELAY_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [asOfDate, liveThings])

  const approximateCount = useMemo(
    () =>
      (resolution?.things ?? []).filter(
        (thing) =>
          (thing.__asOfLocationSource === 'link' ||
            thing.__asOfLocationSource === 'live') &&
          !!thing.Locations?.length
      ).length,
    [resolution]
  )

  const lostCount = useMemo(
    () =>
      (resolution?.things ?? []).filter(
        (thing) => thing.__asOfLocationSource === 'lost'
      ).length,
    [resolution]
  )

  if (!asOfDate) {
    return {
      things: liveThings,
      resolvedFor: null,
      isLoading: false,
      error: null,
      failedEndpoints: [],
      readingsUnavailableEndpoints: [],
      approximateCount: 0,
      lostCount: 0,
    }
  }

  return {
    things: resolution?.things ?? [],
    resolvedFor: resolution?.asOf ?? null,
    isLoading: isLoading || resolution?.asOf !== asOfDate,
    error: resolution?.error ?? null,
    failedEndpoints: resolution?.failedEndpoints ?? [],
    readingsUnavailableEndpoints: resolution?.readingsUnavailableEndpoints ?? [],
    approximateCount,
    lostCount,
  }
}
