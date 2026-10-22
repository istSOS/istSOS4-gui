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

import { useEffect, useRef, useState } from 'react'

import type { Thing } from '@/types/domain'
import {
  activeAdapter,
  type ExistenceState,
  type ResolvedThing,
} from '../adapters/asOfAdapter'

// ---------------------------------------------------------------------------
// Types (re-exported for consumers)
// ---------------------------------------------------------------------------

export type { ExistenceState } from '../adapters/asOfAdapter'

export type AsOfThingResult = {
  /** The thing as it existed at asOfDate (or the live thing when not in snapshot mode) */
  snapshotThing: Thing | null
  isLoading: boolean
  /**
   * Set when the snapshot could not be resolved. `snapshotThing` then holds the
   * LIVE thing so the panel is never blank — consumers must say so rather than
   * present it as snapshot data.
   */
  error: string | null
  /**
   * 'exists'          — a valid version was resolved for asOfDate.
   * 'not-yet-created' — asOfDate is before the Thing's earliest version.
   * 'deleted'         — asOfDate is after the Thing's last closed version.
   * Always 'exists' in live mode (asOfDate is null).
   */
  existenceState: ExistenceState
  /** ISO dates of the Thing's creation and (optional) decommission time. */
  existenceRange: { createdAt: string | null; deletedAt: string | null }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Resolves the thing a user sees in the DatastreamTable at a given point in time.
 *
 * - When `asOfDate` is null: returns the live thing unchanged.
 * - Delegates to `activeAdapter.resolveThing()` which handles both mock
 *   (local dummy data) and real API (`$as_of` endpoint) modes transparently.
 *
 * To switch between mock and real modes, set the env variable:
 *   `NEXT_PUBLIC_VERSIONING_ENABLED=true`
 *
 * Re-fires automatically when selectedThing or asOfDate changes.
 */
export function useAsOfThing({
  thing,
  asOfDate,
}: {
  thing: Thing | null
  asOfDate: string | null
}): AsOfThingResult {
  // The resolution is stored together with the (thing, date) it belongs to, so
  // it can never be rendered for a different thing or a different date.
  const [resolution, setResolution] = useState<{
    key: string
    thingKey: string
    result: ResolvedThing
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Scoped by data source: two sources can hand out the same @iot.id.
  const thingKey = thing
    ? `${String(thing.__sourceEndpoint ?? '')}::${String(
        thing['@iot.id'] ?? thing.id ?? thing.name ?? ''
      )}`
    : ''
  const requestKey = thing && asOfDate ? `${thingKey}|${asOfDate}` : ''

  // The selection hands over a new object for the same Thing whenever the
  // map's list is re-read — the live one, then the snapshot's copy. Only the
  // identity and the instant decide what to resolve, so that is not a reason
  // to ask again (or to cancel a request already on its way).
  const thingRef = useRef(thing)
  thingRef.current = thing

  useEffect(() => {
    const thing = thingRef.current
    // Live mode — nothing to resolve. The live thing is returned below without
    // waiting for any async work, so leaving snapshot mode shows live data on
    // the very same render.
    if (!requestKey || !thing || !asOfDate) {
      setResolution(null)
      setIsLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    activeAdapter
      .resolveThing(thing, asOfDate)
      .then((result) => {
        if (cancelled) return
        setResolution({ key: requestKey, thingKey, result })
        setError(null)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('[useAsOfThing] Error resolving snapshot:', err)
        // Drop the previous resolution: it belongs to another date and must not
        // be passed off as this one. The live thing is shown instead, and
        // `error` tells consumers to label it as such.
        setResolution(null)
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [asOfDate, requestKey, thingKey])

  // A resolution for this exact date, or — while a new date is still loading —
  // the previous one for the SAME thing, which keeps scrubbing from flickering.
  // A resolution belonging to another thing is never reused.
  const active =
    resolution && (resolution.key === requestKey || resolution.thingKey === thingKey)
      ? resolution.result
      : null

  const isSnapshotMode = !!asOfDate && !!thing

  return {
    snapshotThing: isSnapshotMode ? (active?.thing ?? thing) : thing,
    isLoading,
    error,
    existenceState: isSnapshotMode
      ? (active?.existenceState ?? 'exists')
      : 'exists',
    existenceRange: isSnapshotMode
      ? (active?.existenceRange ?? { createdAt: null, deletedAt: null })
      : { createdAt: null, deletedAt: null },
  }
}
