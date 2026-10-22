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
 * @file features/observations/components/ReadingDetailsRail.tsx
 *
 * The panel beside the chart that answers "why does this reading say what it
 * says" — the commit that produced it, in full.
 *
 * It sits beside the plot rather than on top of it because the Observations
 * modal is wide (up to 1440px) and short (a fixed 62vh, leaving the chart about
 * 330px). A panel spends one axis or the other; this one spends the abundant
 * one. It also stays open across clicks, so a run of readings can be walked
 * without reopening anything — which a tooltip cannot do.
 */

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { useTranslation } from 'react-i18next'

import { CloseIcon } from '@/components/icons'
import CommitAuthor from '@/features/users/components/CommitAuthor'
import type { RecordCommit } from '@/types/domain'

import {
  QUALITY_COLORS,
  describeRuleCondition,
  qualityLabel,
  type QualityClass,
  type QualityRuleRef,
  type QualityScheme,
} from '../lib/resultQuality'

dayjs.extend(utc)

/** One series' reading at the selected instant, with its commit. */
export type ReadingDetailsEntry = {
  seriesId: string
  /** Datastream name in live mode; the snapshot label in As-Of compare mode. */
  seriesName: string
  color: string
  value: number
  unit: string
  /** The real instant, which on the aligned axis differs per series. */
  ts: number
  commit: RecordCommit | null
  /** Data source of the reading, for looking up the commit's author. */
  endpoint?: string | null
  /** The chart's reading of this observation's `resultQuality`. */
  qualityClass: QualityClass
  /** The raw index behind it — null when the reading carries none. */
  quality: number | null
  /** The scheme the verdict was reached under, and the rule of it that did. */
  qualityScheme: QualityScheme
  qualityRule: QualityRuleRef
  /**
   * True when the scheme is the viewer's own. Only then is the rule worth a
   * line: under the default, every reading would repeat the same convention.
   */
  qualityCustom: boolean
}

export type ReadingDetails = {
  /** Axis label of the clicked position, already formatted. */
  axisLabel: string
  entries: ReadingDetailsEntry[]
}

/**
 * One labelled row.
 *
 * Every fact in an entry is one of these, on one shared grid, so the values
 * line up in a single column and the block can be scanned down rather than
 * read. Earlier revisions gave the action a badge and the commit id a floating
 * caption, which put five type treatments in a 260px column and read as
 * clutter — the structure IS the alignment, so nothing gets its own styling.
 */
function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <>
      <dt className="whitespace-nowrap text-xs opacity-55">{label}</dt>
      <dd className="m-0 min-w-0 break-words text-xs tabular-nums">
        {children}
      </dd>
    </>
  )
}

export default function ReadingDetailsRail({
  details,
  onClose,
}: {
  details: ReadingDetails
  onClose: () => void
}) {
  const { t } = useTranslation()

  return (
    <aside
      aria-label={t('as_of.chart.commit.title')}
      className="ml-3 flex w-[260px] shrink-0 flex-col overflow-hidden rounded-md border border-default-200 border-l-2 border-l-primary bg-content1"
    >
      <div className="flex items-start justify-between gap-2 border-b border-default-200 px-3 py-2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wide opacity-70">
            {t('as_of.chart.commit.title')}
          </div>
          <div className="truncate text-xs font-semibold">
            {details.axisLabel}
          </div>
        </div>
        <button
          type="button"
          aria-label={t('general.close')}
          className="shrink-0 rounded p-0.5 opacity-60 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </div>

      <div className="flex-1 divide-y divide-default-200 overflow-y-auto">
        {details.entries.map((entry) => (
          <section key={entry.seriesId} className="px-3 py-2.5">
            {/* The series and its reading — the only line that carries weight,
                so the eye lands here first and the facts below stay quiet. */}
            <div className="mb-1.5 flex items-baseline gap-1.5">
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 shrink-0 translate-y-[-2px] rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="min-w-0 flex-1 truncate text-xs font-semibold">
                {entry.seriesName}
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {entry.value}
                {entry.unit ? ` ${entry.unit}` : ''}
              </span>
            </div>

            {/* One grid for every fact, so the values share a column.
                `encodingType` is deliberately absent: it is the media type of
                the message, hardcoded to text/plain by the API for every commit
                ever written, so it distinguishes nothing.

                Both timestamps are labelled because the difference between them
                is the whole point of As-Of — when the sensor read it, against
                when someone wrote that value down. Unlabelled and stacked, they
                read as a contradiction. */}
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              {/* First, and only when the reading carries one: "out of range,
                  written by a QC run on the 28th" is one story, and splitting
                  the verdict from the commit that recorded it would make the
                  reader assemble it. The raw code rides along because the 100
                  index is a convention, not something the record asserts — and
                  anyone debugging an ingest needs the number actually stored. */}
              {entry.qualityClass !== 'none' && (
                <Row label={t('quality.label')}>
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="inline-block h-2 w-2 shrink-0 rounded-[2px]"
                      style={{
                        backgroundColor: QUALITY_COLORS[entry.qualityClass],
                      }}
                    />
                    {qualityLabel(entry.qualityClass, entry.qualityScheme, t)}
                    {entry.quality !== null && (
                      <span className="opacity-60">{entry.quality}</span>
                    )}
                  </span>
                </Row>
              )}
              {entry.qualityClass !== 'none' && entry.qualityCustom && (
                <Row label={t('quality.rule')}>
                  {typeof entry.qualityRule === 'number' &&
                  entry.qualityScheme.rules[entry.qualityRule]
                    ? `#${entry.qualityRule + 1} · ${describeRuleCondition(
                        entry.qualityScheme.rules[entry.qualityRule]
                      )}`
                    : t('quality.rule_fallback')}
                </Row>
              )}

              <Row label={t('as_of.chart.commit.measured')}>
                {/* On the aligned axis the series share an offset but sit at
                    different real instants, so each carries its own. */}
                {dayjs.utc(entry.ts).format('MMM D, YYYY HH:mm')} UTC
              </Row>

              {entry.commit ? (
                <>
                  {entry.commit.actionType && (
                    <Row label={t('as_of.chart.commit.action')}>
                      {entry.commit.actionType}
                    </Row>
                  )}
                  {entry.commit.date && (
                    <Row label={t('as_of.chart.commit.committed')}>
                      {dayjs
                        .utc(entry.commit.date)
                        .format('MMM D, YYYY HH:mm')}{' '}
                      UTC
                    </Row>
                  )}
                  {entry.commit.author && (
                    <Row label={t('as_of.chart.commit.by')}>
                      <CommitAuthor
                        author={entry.commit.author}
                        endpoint={entry.endpoint}
                      />
                    </Row>
                  )}
                  {entry.commit['@iot.id'] != null && (
                    <Row label={t('as_of.chart.commit.id')}>
                      {entry.commit['@iot.id']}
                    </Row>
                  )}
                </>
              ) : (
                <Row label={t('as_of.chart.commit.action')}>
                  <span className="opacity-70">
                    {t('as_of.chart.commit.none')}
                  </span>
                </Row>
              )}
            </dl>

            {/* Last and unlabelled: it is the payload, not another field, and
                it is the one value whose height varies — keeping it out of the
                grid means a long message cannot push the labels around. */}
            {entry.commit?.message && (
              <p className="mt-2 whitespace-pre-wrap break-words text-xs font-medium text-primary">
                {entry.commit.message}
              </p>
            )}
          </section>
        ))}
      </div>
    </aside>
  )
}
