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
 * @file features/observations/components/customize-quality/BitmaskStep.tsx
 *
 * Step 2 when the istSOS4 QC bitmask is the starting point.
 *
 * The bitmask has nothing to edit — what each pair means comes from the
 * datastream's own constraints — so where the rules step offers an editor,
 * this one shows how a value will be read: which pair reports on which check,
 * how the pairs become one OASI score, and what each stored value decodes to.
 */

import { useTranslation } from 'react-i18next'

import type { GraphRow } from '../../lib/observationGraphUtils'
import {
  OASI_SCORES,
  QUALITY_COLORS,
  QUALITY_STATUS_COLORS,
  classifyQuality,
  describeConstraint,
  formatQualityPairs,
  qualityLabel,
  tallyQuality,
  type BitmaskQualityClass,
  type QualityCheckStatus,
  type QualityConstraint,
  type QualityScheme,
} from '../../lib/resultQuality'
import type { StoredValue } from './StoredValues'

/** The order `oasiVerdict` tries them in: the first that applies decides. */
const OASI_ORDER: BitmaskQualityClass[] = [
  'oasi10',
  'oasi6',
  'oasi1',
  'oasi3',
  'oasi2',
  'oasi0',
  'none',
  'undecodable',
]

const PAIR_VALUES: Array<{
  bits: string
  data: QualityCheckStatus
  check: QualityCheckStatus
}> = [
  { bits: '11', data: 'raw', check: 'passed' },
  { bits: '10', data: 'filled', check: 'failed' },
  { bits: '00', data: 'no_data', check: 'not_executed' },
  { bits: '01', data: 'digital', check: 'unused' },
]

const sectionTitle = 'mb-1.5 text-[13px] font-semibold'
const cell = 'px-2 py-1'
const headCell = `${cell} font-semibold`

function Swatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="inline-block h-2 w-2 shrink-0 rounded-[2px]"
      style={{ backgroundColor: color }}
    />
  )
}

export default function BitmaskStep({
  draftScheme,
  draftRows,
  values,
  constraints,
}: {
  draftScheme: QualityScheme
  draftRows: GraphRow[]
  values: StoredValue[]
  constraints: QualityConstraint[] | null
}) {
  const { t } = useTranslation()
  const tally = tallyQuality(draftRows)

  const status = (value: QualityCheckStatus) => (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <Swatch color={QUALITY_STATUS_COLORS[value]} />
      {t(`quality.status.${value}`)}
    </span>
  )

  const pairs = constraints
    ? [
        { name: t('quality.bitmask.data_state') },
        ...constraints.map((constraint) => ({
          name: describeConstraint(constraint),
        })),
        { name: t('quality.bitmask.human_review') },
      ]
    : []

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-xs text-default-500">
        {t('quality.customize.bitmask.intro')}
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="min-w-0">
          <div className={sectionTitle}>
            {t('quality.customize.bitmask.pairs_title')}
          </div>
          {constraints ? (
            <>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-default-200 text-left text-[11px] text-default-500">
                    <th className={headCell}>
                      {t('quality.customize.bitmask.pair')}
                    </th>
                    <th className={headCell}>
                      {t('quality.customize.bitmask.bits')}
                    </th>
                    <th className={headCell}>
                      {t('quality.customize.bitmask.reports_on')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pairs.map((pair, index) => (
                    <tr key={index} className="border-b border-default-200">
                      <td className={`${cell} tabular-nums`}>{index}</td>
                      <td className={`${cell} font-mono tabular-nums`}>
                        {2 * index + 1}–{2 * index}
                      </td>
                      <td className={`${cell} break-words`}>{pair.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {constraints.length === 0 && (
                <p className="m-0 mt-1.5 text-[11px] text-default-500">
                  {t('quality.customize.bitmask.no_constraints')}
                </p>
              )}
            </>
          ) : (
            <p className="m-0 rounded-lg border border-warning/60 p-2.5 text-xs text-warning-700">
              {t('quality.bitmask.constraints_unreadable')}
            </p>
          )}

          <table className="mt-3 w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-default-200 text-left text-[11px] text-default-500">
                <th className={headCell}>
                  {t('quality.customize.bitmask.bits')}
                </th>
                <th className={headCell}>
                  {t('quality.bitmask.data_state')}
                </th>
                <th className={headCell}>
                  {t('quality.customize.bitmask.checks_and_review')}
                </th>
              </tr>
            </thead>
            <tbody>
              {PAIR_VALUES.map((row) => (
                <tr key={row.bits} className="border-b border-default-200">
                  <td className={`${cell} font-mono`}>{row.bits}</td>
                  <td className={cell}>{status(row.data)}</td>
                  <td className={cell}>{status(row.check)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="m-0 mt-1.5 text-[11px] text-default-500">
            {t('quality.customize.bitmask.no_review_note')}
          </p>
        </section>

        <section className="min-w-0">
          <div className={sectionTitle}>
            {t('quality.customize.bitmask.oasi_title')}
          </div>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-default-200 text-left text-[11px] text-default-500">
                <th className={headCell}>
                  {t('quality.customize.bitmask.when')}
                </th>
                <th className={headCell}>
                  {t('quality.customize.rules.verdict')}
                </th>
                <th className={`${headCell} text-right`}>
                  {t('quality.customize.review.readings')}
                </th>
              </tr>
            </thead>
            <tbody>
              {OASI_ORDER.map((key) => {
                const oasi =
                  key in OASI_SCORES
                    ? OASI_SCORES[key as keyof typeof OASI_SCORES]
                    : null
                return (
                  <tr key={key} className="border-b border-default-200">
                    <td className={cell}>
                      {t(`quality.customize.bitmask.cases.${key}`)}
                    </td>
                    <td className={cell}>
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <Swatch color={QUALITY_COLORS[key]} />
                        {qualityLabel(key, draftScheme, t)}
                        {oasi && (
                          <span className="text-default-400">
                            {oasi.score} · {oasi.level}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className={`${cell} text-right tabular-nums`}>
                      {tally[key].toLocaleString()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="m-0 mt-1.5 text-[11px] text-default-500">
            {t('quality.customize.bitmask.oasi_note')}
          </p>
        </section>
      </div>

      <section className="min-w-0">
        <div className={sectionTitle}>{t('quality.customize.values.title')}</div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-default-200 text-left text-[11px] text-default-500">
                <th className={headCell}>
                  {t('quality.customize.review.value')}
                </th>
                <th className={headCell}>
                  {t('quality.customize.bitmask.pairs_col')}
                </th>
                <th className={headCell}>
                  {t('quality.customize.rules.verdict')}
                </th>
                <th className={`${headCell} text-right`}>
                  {t('quality.customize.review.readings')}
                </th>
              </tr>
            </thead>
            <tbody>
              {values.map(({ quality, count }) => {
                const verdict = classifyQuality(quality, draftScheme, constraints)
                return (
                  <tr
                    key={quality ?? 'none'}
                    className="border-b border-default-200"
                  >
                    <td className={`${cell} font-mono tabular-nums`}>
                      {quality ?? t('quality.customize.values.no_value')}
                    </td>
                    <td className={`${cell} font-mono tabular-nums`}>
                      {quality !== null && constraints
                        ? (formatQualityPairs(quality, constraints) ?? '—')
                        : '—'}
                    </td>
                    <td className={cell}>
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        <Swatch color={QUALITY_COLORS[verdict]} />
                        {qualityLabel(verdict, draftScheme, t)}
                      </span>
                    </td>
                    <td className={`${cell} text-right tabular-nums`}>
                      {count.toLocaleString()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
