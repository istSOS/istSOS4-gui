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
 * @file features/from-to/hooks/useRelatedEntities.ts
 *
 * Loads the entity rail.
 *
 * Kept separate from `useEntityHistory` on purpose: the rail costs one read per
 * relation plus one count per related entity, so it is slower than the history
 * itself. The page renders its timeline, versions and diff from the history
 * response, and the rail fills in when it arrives — a failure here leaves the
 * page working.
 */

import { useEffect, useState } from 'react'

import { normalizedBasePath } from '@/app/home/utils'
import type { HistoryWindow } from '@/features/from-to/lib/historyWindow'

const RELATED_API = `${normalizedBasePath}/api/from-to/related`
const CHANGES_API = `${normalizedBasePath}/api/from-to/changes`

export type RelatedEntity = {
  path: string
  id: string
  name: string
  /** Versions in the window, or `null` when the count could not be read. */
  count: number | null
}

export type RelatedGroup = {
  relation: string
  set: string
  /** How many related entities exist, regardless of how many are listed. */
  total: number | null
  /** True when the relation is too large to list — a Datastream's 2016 Observations. */
  tooMany: boolean
  /** True when a too-large relation can still report its changes in the window. */
  countable: boolean
  items: RelatedEntity[]
}

/**
 * A too-large relation's changes in the window, per relation name. `loading`
 * while its count is in flight; `value` null when it could not be counted
 * exactly, in which case the rail keeps its plain "too many to list" line.
 */
export type RelationChanges = Record<
  string,
  { status: 'loading' | 'done'; value: number | null }
>

export function useRelatedEntities(
  path: string,
  window: HistoryWindow | null,
): { groups: RelatedGroup[]; loading: boolean; changes: RelationChanges } {
  const [groups, setGroups] = useState<RelatedGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [changes, setChanges] = useState<RelationChanges>({})

  useEffect(() => {
    if (!path || !window) {
      setLoading(false)
      return
    }

    let active = true
    setLoading(true)
    // Counts belong to one path and window; never show the previous one's.
    setChanges({})

    fetch(RELATED_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, from: window.from, to: window.to }),
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null)
        if (!active) return
        const loaded: RelatedGroup[] =
          payload?.ok && Array.isArray(payload.groups) ? payload.groups : []
        setGroups(loaded)

        // The rail is shown now; each large relation's change count follows on
        // its own, so a slow one delays only its own line.
        const countable = loaded.filter((group) => group.tooMany && group.countable)
        if (countable.length === 0) return
        setChanges(
          Object.fromEntries(
            countable.map((group) => [group.relation, { status: 'loading', value: null }]),
          ),
        )
        for (const group of countable) {
          fetch(CHANGES_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, set: group.set, from: window.from, to: window.to }),
          })
            .then((response) => response.json().catch(() => null))
            .catch(() => null)
            .then((result) => {
              if (!active) return
              const value = typeof result?.changes === 'number' ? result.changes : null
              setChanges((current) => ({
                ...current,
                [group.relation]: { status: 'done', value },
              }))
            })
        }
      })
      .catch(() => {
        if (active) setGroups([])
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [path, window?.from, window?.to])

  return { groups, loading, changes }
}
