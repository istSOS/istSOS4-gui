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
import { useEffect, useRef, useState } from 'react'

import type { Thing } from '@/types/domain'
import { activeAdapter, type AsOfCommit } from '../adapters/asOfAdapter'

dayjs.extend(utc)

// ---------------------------------------------------------------------------
// Types (re-exported for consumers)
// ---------------------------------------------------------------------------

export type { AsOfCommit } from '../adapters/asOfAdapter'

export type AsOfCommitsResult = {
  /** Ordered list of commits from oldest to newest */
  commits: AsOfCommit[]
  /** ISO string of the earliest commit — the scrubber's left bound */
  firstDate: string | null
  /** ISO string of "now" — the scrubber's right bound */
  lastDate: string
  isLoading: boolean
  error: string | null
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Resolves the commit history for a given Thing so the TimelineScrubber
 * knows the range [firstCommit → now] and where to place tick marks.
 *
 * Delegates to `activeAdapter.fetchCommits()` which handles both mock
 * (local dummy data) and real API (`/Things(id)/Commit`) modes.
 *
 * To switch between mock and real modes, set the env variable:
 *   `NEXT_PUBLIC_VERSIONING_ENABLED=true`
 *
 * Re-runs whenever the selected Thing changes.
 */
export function useAsOfCommits({
  thing,
}: {
  thing: Thing | null
}): AsOfCommitsResult {
  const [commits, setCommits] = useState<AsOfCommit[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // In snapshot mode the selected object is the Thing *as of* the scrubber, so
  // it is a new object at every instant. The history belongs to the Thing, not
  // to the instant: refetching it per move would re-request the whole timeline
  // on every drag step. Only the Thing's identity triggers a fetch.
  const thingKey = thing
    ? `${String(thing.__sourceEndpoint ?? '')}::${String(
        thing['@iot.id'] ?? thing.id ?? thing.name ?? ''
      )}`
    : ''
  const thingRef = useRef(thing)
  thingRef.current = thing

  useEffect(() => {
    const thing = thingRef.current
    if (!thing) {
      setCommits([])
      setIsLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    activeAdapter
      .fetchCommits(thing)
      .then((result) => {
        if (cancelled) return
        setCommits(result)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('[useAsOfCommits] Error fetching commits:', err)
        setError(String(err))
        setCommits([])
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [thingKey])

  // Scrubber right bound is always "now"
  const lastDate = dayjs.utc().toISOString()

  // Left bound: earliest commit date, or fall back to earliest datastream phenomenonTime
  let firstDate: string | null = commits.length > 0 ? commits[0].authoredAt : null

  if (!firstDate && thing) {
    const datastreams = thing.Datastreams ?? []
    let earliest: ReturnType<typeof dayjs.utc> | null = null
    for (const ds of datastreams) {
      const pt = (ds as { phenomenonTime?: string | null }).phenomenonTime
      if (!pt) continue
      const startRaw = pt.split('/')[0]
      if (!startRaw) continue
      const d = dayjs.utc(startRaw)
      if (d.isValid() && (!earliest || d.isBefore(earliest))) earliest = d
    }
    if (earliest) firstDate = earliest.toISOString()
  }

  return { commits, firstDate, lastDate, isLoading, error }
}
