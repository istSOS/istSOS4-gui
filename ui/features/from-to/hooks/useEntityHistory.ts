'use client'

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
 * @file features/from-to/hooks/useEntityHistory.ts
 *
 * Loads one entity's version history for the history page.
 *
 * Goes through the Next route rather than the API directly: the API is reached
 * over a Docker network name the browser cannot resolve, and it sends no CORS
 * headers. The route answers the whole page in one upstream request — every
 * version in the window, each with its body and its commit — so the timeline,
 * the version list and every diff render without further round trips.
 */

import { useCallback, useEffect, useState } from 'react'

import { normalizedBasePath } from '@/app/home/utils'
import type { HistoryWindow } from '@/features/from-to/lib/historyWindow'
import type { EntityVersion } from '@/features/from-to/lib/versionRows'

const HISTORY_API = `${normalizedBasePath}/api/from-to/history`

export type EntityHistoryState = {
  versions: EntityVersion[]
  /** Entity set and key the API actually read, after any path rewrite. */
  entitySet: string | null
  entityId: string | null
  /** True when the window holds more versions than one page returned. */
  hasMore: boolean
  /** How many versions the window holds in total, across all pages. */
  total: number | null
  loading: boolean
  /** Human-readable failure, already translated out of the API's opaque 500s. */
  error: string | null
  reload: () => void
}

export function useEntityHistory(
  path: string,
  window: HistoryWindow | null,
): EntityHistoryState {
  const [versions, setVersions] = useState<EntityVersion[]>([])
  const [entitySet, setEntitySet] = useState<string | null>(null)
  const [entityId, setEntityId] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => setReloadToken((n) => n + 1), [])

  useEffect(() => {
    if (!path || !window) {
      setLoading(false)
      return
    }

    // A late response from a superseded request must not overwrite a newer one:
    // the window can change while a fetch is in flight.
    let active = true
    setLoading(true)
    setError(null)

    fetch(HISTORY_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, from: window.from, to: window.to }),
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null)
        if (!active) return

        if (!response.ok || !payload?.ok) {
          setVersions([])
          setError(payload?.error ?? `${response.status} ${response.statusText}`.trim())
          return
        }

        setVersions(Array.isArray(payload.versions) ? payload.versions : [])
        setEntitySet(payload.entitySet ?? null)
        setEntityId(payload.entityId ?? null)
        setHasMore(!!payload.hasMore)
        setTotal(typeof payload.total === 'number' ? payload.total : null)
      })
      .catch((cause: unknown) => {
        if (!active) return
        setVersions([])
        setError(cause instanceof Error ? cause.message : String(cause))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [path, window?.from, window?.to, reloadToken])

  return { versions, entitySet, entityId, hasMore, total, loading, error, reload }
}
