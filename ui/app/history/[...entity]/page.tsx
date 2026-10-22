'use server'

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
 * @file app/history/[...entity]/page.tsx
 *
 * Route for the entity history page: `/history/Things(1)?from=…&to=…`.
 *
 * A catch-all segment so a path can be addressed the way the API writes it. It
 * is normally one segment (`Things(1)`), and a child entity is addressed by its
 * OWN path rather than through a parent — reading history through a parent
 * duplicates every version, and on a many-to-many relation returns the wrong
 * entities entirely.
 *
 * The window arrives as `from`/`to` search params rather than in a context, so
 * reload, back, forward and a pasted link all land on the same history.
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import HistoryPage from '@/app/history/[...entity]/HistoryPage'
import { siteConfig } from '@/config/site'
import {
  parseWindow,
  validateWindow,
  type HistoryWindow,
} from '@/features/from-to/lib/historyWindow'
import { isTokenExpired } from '@/lib/auth'

type PageProps = {
  params: Promise<{ entity: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function firstValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

export default async function Page({ params, searchParams }: PageProps) {
  const cookieStore = await cookies()
  const token = siteConfig.authorizationEnabled
    ? (cookieStore.get('token')?.value ?? null)
    : null

  if (siteConfig.authorizationEnabled && (!token || isTokenExpired(token))) {
    redirect('/login')
  }

  const { entity } = await params
  const query = await searchParams

  // Next decodes each segment; rejoining gives back the path as written.
  const path = (entity ?? []).map((segment) => decodeURIComponent(segment)).join('/')

  const from = firstValue(query.from)
  const to = firstValue(query.to)

  // Validated here rather than in the browser so a hand-edited or stale link
  // explains itself instead of reaching the API, which answers every bad window
  // with an opaque 500.
  const candidate: HistoryWindow = { from, to }
  const problems = validateWindow(candidate)
  const window = problems.length === 0 ? parseWindow(`${from}/${to}`) : null

  const windowError =
    problems.length === 0
      ? null
      : problems[0].reason === 'after-to'
        ? 'The start of the window must be before its end.'
        : 'This link is missing a readable time window.'

  return (
    <HistoryPage
      path={path}
      window={window}
      windowError={windowError}
      initialA={versionIndex(query.a)}
      initialB={versionIndex(query.b)}
    />
  )
}

/**
 * Reads an `a`/`b` search param into a zero-based position.
 *
 * They are written 1-based because that is what the page shows — "Version 1" in
 * the link means version 1 on screen. Anything unreadable falls back to the
 * page's own default rather than erroring: a comparison is not worth failing a
 * page load over.
 */
function versionIndex(value: string | string[] | undefined): number | null {
  const raw = Number(firstValue(value))
  if (!Number.isInteger(raw) || raw < 1) return null
  return raw - 1
}
