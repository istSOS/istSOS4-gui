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
 * @file server/users/read.ts
 *
 * Server-side read of one istSOS4 user, for naming a commit's author.
 *
 * Deployments differ in what they expose, and each answers differently:
 *
 *   AUTHORIZATION=1, with GET /Users(id)   200 · 404 "User not found." · 401
 *   AUTHORIZATION=1, older API             /Users(id) is unknown (404 from the
 *                                          generic reader, or 401 before it);
 *                                          only the admin-only GET /Users list
 *   AUTHORIZATION=0                        no user routes at all: 404 "unknown
 *                                          collection" — yet commits written
 *                                          while authorization was on still
 *                                          name `/Users(<id>)` as author
 *
 * So a 404 from `/Users(id)` only means "no such user" when it is the one the
 * user endpoint itself writes; any other 404 falls back to the list, and a 404
 * there too means the server has no users to show.
 */

import type { UserDetails } from '@/features/users/hooks/useUser'

export type UserReadReason =
  /** Not signed in, or the token is expired or revoked. */
  | 'denied'
  /** Signed in, but this server only shows users to administrators. */
  | 'forbidden'
  | 'missing'
  /** The server exposes no user routes (authorization off). */
  | 'unavailable'
  | 'error'

export type UserReadResult =
  | { ok: true; user: UserDetails }
  | { ok: false; reason: UserReadReason; error?: string }

/** The exact 404 body of `GET /Users(id)` — distinguishes it from a route miss. */
const USER_NOT_FOUND = 'User not found.'
/** The 401 body both user routes send to an authenticated non-administrator. */
const INSUFFICIENT_PRIVILEGES = 'Insufficient privileges.'

async function readJson(response: Response): Promise<Record<string, unknown> | null> {
  return (await response.json().catch(() => null)) as Record<string, unknown> | null
}

function messageOf(body: Record<string, unknown> | null): string {
  return String(body?.message ?? body?.detail ?? '')
}

/**
 * Only the fields the popover shows ever leave the server. The list fallback
 * returns whole `"User"` rows, and pending auth work adds a bcrypt `password`
 * column to that table — a row must never be forwarded to the browser as-is.
 *
 * `contact` is forwarded whenever the API sent the column, even as null: its
 * presence is how the popover knows the caller may see contact details, so
 * "none on record" and "not yours to see" stay apart without a role check here.
 */
function publicFields(row: Record<string, unknown>): UserDetails {
  const user: UserDetails = {
    id: Number(row.id),
    username: String(row.username ?? ''),
    role: String(row.role ?? ''),
    uri: typeof row.uri === 'string' ? row.uri : null,
  }
  if ('contact' in row) user.contact = row.contact ?? null
  return user
}

function refusal(status: number, body: Record<string, unknown> | null): UserReadResult | null {
  if (status !== 401 && status !== 403) return null
  return {
    ok: false,
    reason: messageOf(body) === INSUFFICIENT_PRIVILEGES ? 'forbidden' : 'denied',
  }
}

export async function fetchUser(
  endpoint: string,
  id: string,
  headers: Record<string, string>
): Promise<UserReadResult> {
  const byId = await fetch(`${endpoint}/Users(${id})`, { headers, cache: 'no-store' })
  const byIdBody = await readJson(byId)

  if (byId.ok && byIdBody) return { ok: true, user: publicFields(byIdBody) }
  if (byId.status === 404 && messageOf(byIdBody) === USER_NOT_FOUND) {
    return { ok: false, reason: 'missing' }
  }
  // A 401 here may come from the route (bad token) or, on an older API, from
  // the generic reader in front of an unknown path — either way the token was
  // refused, and the list below would refuse it too.
  const refusedById = refusal(byId.status, byIdBody)
  if (refusedById) return refusedById
  if (byId.status !== 404) {
    return { ok: false, reason: 'error', error: messageOf(byIdBody) || byId.statusText }
  }

  // No single-user route on this server. The list is administrator-only and
  // has no filter, so the user is picked out here.
  const list = await fetch(`${endpoint}/Users`, { headers, cache: 'no-store' })
  const listBody = await readJson(list)

  if (list.ok) {
    const rows = Array.isArray(listBody?.value)
      ? (listBody.value as Array<Record<string, unknown>>)
      : []
    const row = rows.find((entry) => String(entry?.id) === id)
    return row ? { ok: true, user: publicFields(row) } : { ok: false, reason: 'missing' }
  }
  const refusedList = refusal(list.status, listBody)
  if (refusedList) return refusedList
  if (list.status === 404) return { ok: false, reason: 'unavailable' }
  return { ok: false, reason: 'error', error: messageOf(listBody) || list.statusText }
}
