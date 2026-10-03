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

import {
  QUALITY_COLORS,
  classifyQuality,
  qualityLabel,
  type QualityScheme,
} from '../../lib/resultQuality'

/** One distinct stored index in the window, and how many readings carry it. */
export type StoredValue = { quality: number | null; count: number }

/**
 * The distinct quality indexes in a set of readings, highest first and "no
 * value" last — the order a reader scans a quality scale in.
 */
export function distinctStoredValues(
  rows: Array<{ quality: number | null }>
): StoredValue[] {
  const counts = new Map<number | null, number>()
  for (const row of rows) {
    counts.set(row.quality, (counts.get(row.quality) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([quality, count]) => ({ quality, count }))
    .sort((a, b) => {
      if (a.quality === null) return 1
      if (b.quality === null) return -1
      return b.quality - a.quality
    })
}

/**
 * What the window actually holds: each stored value, how often, and its verdict
 * under the draft. A row whose verdict differs from the rules in use is
 * highlighted, so the effect of a change can be read without the chart.
 */
export default function StoredValues({
  values,
  currentScheme,
  draftScheme,
  onAddRule,
}: {
  values: StoredValue[]
  currentScheme: QualityScheme
  draftScheme: QualityScheme
  /** Offers "+ Rule" beside each stored value when given. */
  onAddRule?: (quality: number) => void
}) {
  const { t } = useTranslation()

  return (
    <ul className="m-0 flex list-none flex-col overflow-hidden rounded-md border border-default-200 p-0">
      {values.map(({ quality, count }) => {
        const verdict = classifyQuality(quality, draftScheme)
        const changed = verdict !== classifyQuality(quality, currentScheme)
        return (
          <li
            key={quality ?? 'none'}
            className={`grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 border-t border-default-200 px-2.5 py-1 text-xs first:border-t-0 ${
              changed ? 'bg-warning/10' : ''
            }`}
          >
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block h-2 w-2 shrink-0 rounded-[2px]"
                style={{ backgroundColor: QUALITY_COLORS[verdict] }}
              />
              <span className={quality === null ? 'opacity-60' : 'font-mono tabular-nums'}>
                {quality === null ? t('quality.customize.values.no_value') : quality}
              </span>
              <span className="truncate opacity-60">
                {qualityLabel(verdict, draftScheme, t)}
              </span>
            </span>
            <span className="tabular-nums opacity-60">
              {t('quality.customize.values.count', { count })}
            </span>
            {onAddRule && quality !== null ? (
              <button
                type="button"
                className="rounded px-1 text-[11px] font-semibold text-primary hover:bg-primary-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                aria-label={t('quality.customize.values.add_rule_aria', {
                  value: quality,
                })}
                onClick={() => onAddRule(quality)}
              >
                {t('quality.customize.values.add_rule')}
              </button>
            ) : (
              <span />
            )}
          </li>
        )
      })}
    </ul>
  )
}
