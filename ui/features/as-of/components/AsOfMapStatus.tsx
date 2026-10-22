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

import { useTranslation } from 'react-i18next'

/**
 * What the map is actually showing in snapshot mode, whenever that is not
 * simply "the Things as they were": still loading, live data standing in for
 * a snapshot that failed, or positions that are not known to be historical.
 * Renders nothing when the map is an exact snapshot.
 */
export default function AsOfMapStatus({
  isLoading,
  error,
  failedSourceCount,
  readingsUnavailableCount = 0,
  approximateCount,
  lostCount,
}: {
  isLoading: boolean
  error: string | null
  failedSourceCount: number
  /** Sources drawn at their snapshot positions but without latest readings. */
  readingsUnavailableCount?: number
  approximateCount: number
  lostCount: number
}) {
  const { t } = useTranslation()

  const lines: Array<{ key: string; text: string; tone: 'info' | 'warn' }> = []
  if (isLoading) {
    lines.push({ key: 'loading', text: t('as_of.map.loading'), tone: 'info' })
  }
  if (error) {
    lines.push({ key: 'error', text: t('as_of.map.error'), tone: 'warn' })
  } else if (failedSourceCount > 0) {
    lines.push({
      key: 'failed',
      text: t('as_of.map.failed_sources', { count: failedSourceCount }),
      tone: 'warn',
    })
  }
  if (!error && readingsUnavailableCount > 0) {
    lines.push({
      key: 'readings',
      text: t('as_of.map.readings_unavailable', {
        count: readingsUnavailableCount,
      }),
      tone: 'warn',
    })
  }
  if (approximateCount > 0) {
    lines.push({
      key: 'approximate',
      text: t('as_of.map.approximate', { count: approximateCount }),
      tone: 'warn',
    })
  }

  if (lostCount > 0) {
    lines.push({
      key: 'lost',
      text: t('as_of.map.lost', { count: lostCount }),
      tone: 'warn',
    })
  }

  if (!lines.length) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute left-1/2 top-3 z-[2100] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col items-center gap-1 sm:max-w-md"
    >
      {lines.map((line) => (
        <div
          key={line.key}
          title={line.key === 'error' && error ? error : undefined}
          className="rounded-md px-2.5 py-1 text-center text-[11px] font-semibold leading-snug shadow"
          style={{
            background:
              line.tone === 'warn' ? 'rgba(254,243,199,0.97)' : 'rgba(120,53,15,0.92)',
            color: line.tone === 'warn' ? '#78350f' : '#fde68a',
            border: '1px solid rgba(180,83,9,0.45)',
          }}
        >
          {line.text}
        </div>
      ))}
    </div>
  )
}
