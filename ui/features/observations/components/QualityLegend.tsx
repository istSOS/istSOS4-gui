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
 * @file features/observations/components/QualityLegend.tsx
 *
 * The row under the quality lane: what each colour means, and how much of the
 * shown window is in it.
 *
 * It is both legend and summary on purpose. As a legend it is what keeps the
 * lane from being read by hue alone — every colour on screen is named right
 * here. As a summary it answers the question the lane cannot ("how good is this
 * range overall?"), and because it counts the rows the chart is currently
 * holding, it re-tallies whenever the time range changes.
 *
 * It is also where the lane's rules are reached from: the colours are the
 * rules' output, so the control that changes them sits beside their key.
 */

import { useTranslation } from 'react-i18next'

import { formatSnapshotLabel } from '../lib/observationGraphUtils'
import {
  QUALITY_CLASSES,
  QUALITY_COLORS,
  judgedCount,
  qualityLabel,
  type QualityScheme,
  type QualityTally,
} from '../lib/resultQuality'

export type QualityLegendLane = {
  /** Row prefix — "A"/"B"/"C"… when there are several lanes, absent when there is one. */
  tag?: string
  /** What the tag stands for — the plotted property, when lanes are lettered by series. */
  label?: string
  tally: QualityTally
  /** ISO-8601 snapshot the lane was read at; null for live data. */
  asOf?: string | null
  /** The scheme the lane was judged under — it may rename the verdicts. */
  scheme?: QualityScheme
  /**
   * The same readings under another scheme. When given, each count shows how
   * far it moved from this one — the rules editor's before/after.
   */
  baseline?: QualityTally
}

function SlidersIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M2 4h7M12 4h2M2 12h3M8 12h6M9 2.5v3M5 10.5v3" />
    </svg>
  )
}

export default function QualityLegend({
  lanes,
  onCustomize,
  customized = false,
}: {
  lanes: QualityLegendLane[]
  /** Opens the rules editor. No button when absent. */
  onCustomize?: () => void
  /** True when any lane is read under rules other than the default. */
  customized?: boolean
}) {
  const { t } = useTranslation()

  if (lanes.length === 0) return null

  return (
    // The left inset lines the row up with the plotting area rather than the
    // y-axis labels, so it reads as belonging to the lane above it.
    <div className="flex items-start gap-3 pl-[50px] pr-[50px] text-[11px] leading-tight">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {lanes.map((lane, index) => {
          const total = QUALITY_CLASSES.reduce(
            (sum, key) => sum + lane.tally[key],
            0
          )
          if (total === 0) return null
          const judged = judgedCount(lane.tally)
          // "0% pass" would be a verdict. A window nothing has checked has not
          // failed — it has not been judged, and the summary has to say so, for
          // the snapshot it describes: a snapshot taken before a QC pass ran has
          // no values even though live data may.
          const summary = judged
            ? t('quality.summary', {
                count: total,
                percent: Math.round((lane.tally.pass / judged) * 100),
              })
            : lane.asOf
              ? t('quality.no_values_as_of', {
                  count: total,
                  date: formatSnapshotLabel(lane.asOf),
                })
              : t('quality.no_values_live', { count: total })

          return (
            <div
              key={lane.tag ?? index}
              className="flex flex-wrap items-center gap-x-4 gap-y-0.5"
            >
              <span className="font-semibold tabular-nums">
                {lane.tag ? `${lane.tag} — ` : ''}
                {lane.label ? `${lane.label}: ` : ''}
                {summary}
              </span>
              {QUALITY_CLASSES.filter(
                (key) => lane.tally[key] > 0 || (lane.baseline?.[key] ?? 0) > 0
              ).map((key) => {
                const delta = lane.baseline
                  ? lane.tally[key] - lane.baseline[key]
                  : 0
                // More passing is the good direction; more of anything else is
                // not. Colour follows that, and the sign carries it without.
                const improves = key === 'pass' ? delta > 0 : delta < 0
                return (
                  <span
                    key={key}
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap ${
                      lane.tally[key] > 0 ? 'opacity-80' : 'opacity-45'
                    }`}
                  >
                    <span
                      aria-hidden
                      className="inline-block h-2 w-2 shrink-0 rounded-[2px]"
                      style={{ backgroundColor: QUALITY_COLORS[key] }}
                    />
                    {qualityLabel(key, lane.scheme, t)}{' '}
                    <span className="font-semibold tabular-nums">
                      {lane.tally[key].toLocaleString()}
                    </span>
                    {delta !== 0 && (
                      <span
                        className={`rounded px-1 text-[10px] font-semibold tabular-nums ${
                          improves
                            ? 'bg-success-50 text-success-700'
                            : 'bg-danger-50 text-danger-600'
                        }`}
                      >
                        {delta > 0 ? '+' : '−'}
                        {Math.abs(delta).toLocaleString()}
                      </span>
                    )}
                  </span>
                )
              })}
            </div>
          )
        })}
      </div>
      {onCustomize && (
        <div className="flex shrink-0 items-center gap-2">
          {customized && (
            <span className="whitespace-nowrap rounded-full bg-primary-50 px-2 py-px text-[10px] font-semibold text-primary">
              {t('quality.customize.custom_badge')}
            </span>
          )}
          <button
            type="button"
            onClick={onCustomize}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-primary/40 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <SlidersIcon />
            {customized
              ? t('quality.customize.button_edit')
              : t('quality.customize.button')}
          </button>
        </div>
      )}
    </div>
  )
}
