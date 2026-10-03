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
 * @file features/users/hooks/useUser.ts
 *
 * One user by id, for naming the author of a commit.
 *
 * A version list shows the same few authors on every row, so lookups are shared
 * through a module-level cache keyed by endpoint, id and token: fifty commits
 * by `/Users(1)` cost one request. The token is part of the key because the
 * answer depends on who asks — a "denied" read before signing in, or with a
 * token that has since expired, must not outlive that token. A transport
 * failure is dropped from the cache so the next render can retry.
 */

import { useEffect, useState } from 'react'

import { normalizedBasePath } from '@/app/home/utils'
import { useAuth } from '@/context/AuthContext'
import { getDataSourceToken } from '@/lib/dataSourceTokens'

const USERS_API = `${normalizedBasePath}/api/users`

export type UserDetails = {
  id: number
  username: string
  role: string
  uri?: string | null
  /**
   * Administrator-only: absent for every other caller, null when the user has
   * none on record.
   */
  contact?: unknown
}

export type UserLookup =
  | { kind: 'loading' }
  | { kind: 'user'; user: UserDetails }
  /** Not signed in, or the token was refused (expired, revoked). */
  | { kind: 'denied' }
  /** Signed in, but this server shows users to administrators only. */
  | { kind: 'forbidden' }
  | { kind: 'missing' }
  /** The server has no user routes — it runs with authorization off. */
  | { kind: 'unavailable' }
  | { kind: 'error'; error: string }

type SettledLookup = Exclude<UserLookup, { kind: 'loading' }>

const cache = new Map<string, Promise<SettledLookup>>()

function loadUser(
  id: string,
  endpoint: string | null | undefined,
  token: string | null
): Promise<SettledLookup> {
  const key = `${endpoint ?? ''}|${id}|${token ?? ''}`
  const cached = cache.get(key)
  if (cached) return cached

  const request = fetch(USERS_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id,
      endpoint: endpoint || undefined,
      // Absent, the route falls back to the `token` cookie.
      token: token ?? undefined,
    }),
  })
    .then(async (response): Promise<SettledLookup> => {
      const payload = await response.json().catch(() => null)
      if (payload?.ok && payload.user) return { kind: 'user', user: payload.user }

      const reason = payload?.reason
      if (
        reason === 'denied' ||
        reason === 'forbidden' ||
        reason === 'missing' ||
        reason === 'unavailable'
      ) {
        return { kind: reason }
      }
      throw new Error(payload?.error ?? `${response.status} ${response.statusText}`.trim())
    })
    .catch((cause: unknown): SettledLookup => {
      cache.delete(key)
      return { kind: 'error', error: cause instanceof Error ? cause.message : String(cause) }
    })

  cache.set(key, request)
  return request
}

/**
 * Looks up user `id` on `endpoint` (the primary data source when omitted).
 * Pass `null` as the id to skip the lookup.
 */
export function useUser(id: string | null, endpoint?: string | null): UserLookup | null {
  // The signed-in token, so signing in, out, or a refresh re-runs the lookup.
  // A secondary data source has its own token; the primary one is this one.
  const { token: authToken } = useAuth()
  const token = (endpoint ? getDataSourceToken(endpoint) : null) ?? authToken
  const requestKey = id ? `${endpoint ?? ''}|${id}|${token ?? ''}` : null

  // Only a settled answer is state, tagged with the request it answers. Loading
  // is derived below: any answer for another request is stale, so a new id
  // never shows the previous user's details, even for one frame.
  const [settled, setSettled] = useState<{ key: string; lookup: UserLookup } | null>(null)

  useEffect(() => {
    if (!id || !requestKey) return

    let active = true
    loadUser(id, endpoint, token).then((result) => {
      if (active) setSettled({ key: requestKey, lookup: result })
    })
    return () => {
      active = false
    }
  }, [id, endpoint, token, requestKey])

  if (!requestKey) return null
  return settled?.key === requestKey ? settled.lookup : { kind: 'loading' }
}
