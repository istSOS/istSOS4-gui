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
 * @file features/from-to/components/VersionTimeline.tsx
 *
 * The band of validity periods across the top of the history page.
 *
 * Widths are proportional to how long each version was in force but floored, so
 * a version that lived eight minutes inside a seventeen-day window is still a
 * target — see `timelineBands`. The true duration is printed on every band, so
 * the floor never misleads about how long a version actually lasted.
 *
 * The bands are display only: they mark where sides A and B sit, but choosing
 * the sides belongs to the compare row, so there is one place to do it.
 */

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { useTranslation } from 'react-i18next'

import {
  computeBands,
  formatDuration,
} from '@/features/from-to/lib/timelineBands'
import { validityDurationMs } from '@/lib/systemTimeValidity'
import { versionKey, type EntityVersion } from '@/features/from-to/lib/versionRows'

dayjs.extend(utc)

/** Commit action -> the stripe along the top of a band. */
const ACTION_STRIPE: Record<string, string> = {
  CREATE: 'border-t-success',
  UPDATE: 'border-t-warning',
  DELETE: 'border-t-danger',
}

/**
 * Past this many versions the 4px gaps between bands start to cost more width
 * than the bands themselves, so they close to a hairline.
 */
const DENSE_VERSION_COUNT = 20

function stripeFor(actionType?: string): string {
  return ACTION_STRIPE[actionType ?? ''] ?? 'border-t-default-300'
}

export type VersionTimelineProps = {
  versions: EntityVersion[]
  /** End of the window being viewed; open-ended versions are measured to it. */
  windowEnd: string
  indexA: number
  indexB: number
}

export default function VersionTimeline({
  versions,
  windowEnd,
  indexA,
  indexB,
}: VersionTimelineProps) {
  const { t } = useTranslation()

  if (versions.length === 0) return null

  const widths = computeBands(
    versions.map((version) => version.validity),
    windowEnd,
  )

  return (
    <div className="border-b border-default-100 px-4 py-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <span className="text-tiny font-bold uppercase tracking-wider text-default-500">
          {t('from_to.timeline.heading')}
        </span>
        <span className="flex gap-3 text-tiny text-default-400">
          <Legend className="bg-success" label={t('from_to.timeline.create')} />
          <Legend className="bg-warning" label={t('from_to.timeline.update')} />
          <Legend className="bg-danger" label={t('from_to.timeline.delete')} />
        </span>
      </div>

      {/* The row is always exactly the column's width, never scrolled. Each
          band grows by its share from a zero basis, so the gaps come out of
          the row before the shares are applied and the bands sum to 100% of
          what is left. A band can shrink to its border, so even a full page of
          a hundred versions fits once the gaps drop to a pixel. */}
      <div
        className={[
          'flex items-stretch',
          versions.length > DENSE_VERSION_COUNT ? 'gap-px' : 'gap-1',
        ].join(' ')}
      >
        {versions.map((version, index) => {
          const isA = index === indexA
          const isB = index === indexB
          const open = version.validity.end === null

          return (
            <div
              key={versionKey(version)}
              style={{ flex: `${widths[index]} 1 0%` }}
              // The full label stays one hover away on a band too narrow to
              // print it.
              title={t('from_to.timeline.band_label', {
                number: index + 1,
                start: version.validity.start,
              })}
              className={[
                '@container min-w-0 overflow-hidden rounded-lg border border-t-[3px] text-left',
                stripeFor(version.commit?.actionType),
                isB
                  ? 'border-primary bg-primary/10 ring-1 ring-primary'
                  : isA
                    ? 'border-default-400 bg-default-100'
                    : 'border-default-200',
              ].join(' ')}
            >
              {/* Padding lives here rather than on the band, so a narrow band
                  can drop it. Below the width a label needs, the text goes
                  invisible rather than hidden: the band keeps its height, and
                  a row of narrow bands stays as tall as a row of wide ones. */}
              <div className="px-2 pb-2 pt-1.5 @max-[48px]:px-0.5">
                {/* The side chip sits inline beside the title and comes first, so
                    a narrow band truncates the title, never the chip. */}
                <span className="flex min-w-0 items-center gap-1">
                  {(isA || isB) && (
                    <span
                      className={[
                        'shrink-0 rounded px-1 font-mono text-[9px] font-bold leading-[14px] text-white',
                        isB ? 'bg-primary' : 'bg-default-500',
                      ].join(' ')}
                    >
                      {isB ? 'B' : 'A'}
                    </span>
                  )}
                  <span className="truncate text-[10.5px] font-bold @max-[48px]:invisible">
                    {t('from_to.timeline.version_n', { number: index + 1 })}
                  </span>
                </span>
                <span className="block truncate font-mono text-[9.5px] text-default-400 @max-[48px]:invisible">
                  {dayjs.utc(version.validity.start).format('MM-DD HH:mm')}Z
                </span>
                <span className="block truncate text-[9.5px] text-default-400 @max-[48px]:invisible">
                  {t('from_to.timeline.held', {
                    duration: formatDuration(
                      validityDurationMs(version.validity, windowEnd),
                    ),
                  })}
                  {open ? ` · ${t('from_to.timeline.open')}` : ''}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-2 flex justify-between font-mono text-[9.5px] text-default-400">
        <span>{dayjs.utc(versions[0].validity.start).format('YYYY-MM-DD HH:mm:ss')}Z</span>
        <span className="font-semibold text-primary">
          {t('from_to.timeline.present')}
        </span>
      </div>
    </div>
  )
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <i className={`inline-block h-2 w-2 rounded-sm ${className}`} aria-hidden="true" />
      {label}
    </span>
  )
}
